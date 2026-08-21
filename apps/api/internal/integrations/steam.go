package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const steamAPIBaseURL = "https://api.steampowered.com"

const rustSteamAppID = 252490

type SteamPlayer struct {
	SteamID          string     `json:"steamId"`
	DisplayName      string     `json:"displayName"`
	ProfileURL       string     `json:"profileUrl"`
	AvatarURL        string     `json:"avatarUrl,omitempty"`
	Visibility       string     `json:"visibility"`
	Presence         string     `json:"presence"`
	CurrentGame      string     `json:"currentGame,omitempty"`
	LastLogoffAt     *time.Time `json:"lastLogoffAt,omitempty"`
	ProfileCreatedAt *time.Time `json:"profileCreatedAt,omitempty"`
}

type SteamAccountProfile struct {
	SteamPlayer
	RustPlaytimeMinutes *int   `json:"rustPlaytimeMinutes"`
	RustPlaytimeStatus  string `json:"rustPlaytimeStatus"`
	FriendsPlayingRust  *int   `json:"friendsPlayingRust"`
	FriendsStatus       string `json:"friendsStatus"`
}

type steamPlayerSummaryResponse struct {
	Response struct {
		Players []steamPlayerSummary `json:"players"`
	} `json:"response"`
}

type steamPlayerSummary struct {
	SteamID                  string `json:"steamid"`
	CommunityVisibilityState int    `json:"communityvisibilitystate"`
	ProfileState             int    `json:"profilestate"`
	PersonaName              string `json:"personaname"`
	ProfileURL               string `json:"profileurl"`
	AvatarFull               string `json:"avatarfull"`
	PersonaState             int    `json:"personastate"`
	GameExtraInfo            string `json:"gameextrainfo"`
	GameID                   string `json:"gameid"`
	LastLogoff               int64  `json:"lastlogoff"`
	TimeCreated              int64  `json:"timecreated"`
}

type steamOwnedGamesResponse struct {
	Response *struct {
		Games []struct {
			AppID           int `json:"appid"`
			PlaytimeForever int `json:"playtime_forever"`
		} `json:"games"`
	} `json:"response"`
}

type steamFriendListResponse struct {
	FriendsList *struct {
		Friends []struct {
			SteamID string `json:"steamid"`
		} `json:"friends"`
	} `json:"friendslist"`
}

type steamVanityResponse struct {
	Response struct {
		Success int    `json:"success"`
		SteamID string `json:"steamid"`
	} `json:"response"`
}

func (s *Service) SearchSteamPlayer(ctx context.Context, query string) (SteamPlayer, error) {
	steamID, vanity, err := normalizeSteamLookup(query)
	if err != nil {
		return SteamPlayer{}, err
	}
	if steamID == "" {
		steamID, err = s.resolveSteamVanity(ctx, vanity)
		if err != nil {
			return SteamPlayer{}, err
		}
	}

	players, err := s.steamPlayerSummaries(ctx, []string{steamID})
	if err != nil {
		return SteamPlayer{}, err
	}
	if len(players) == 0 {
		return SteamPlayer{}, ErrResourceNotFound
	}
	return players[0].player(), nil
}

func (s *Service) SteamPlayers(ctx context.Context, steamIDs []string) ([]SteamPlayer, error) {
	unique := make([]string, 0, len(steamIDs))
	seen := make(map[string]struct{}, len(steamIDs))
	for _, steamID := range steamIDs {
		steamID = strings.TrimSpace(steamID)
		if !isSteamID(steamID) || len(unique) >= 100 {
			continue
		}
		if _, exists := seen[steamID]; exists {
			continue
		}
		seen[steamID] = struct{}{}
		unique = append(unique, steamID)
	}
	if len(unique) == 0 {
		return nil, nil
	}
	summaries, err := s.steamPlayerSummaries(ctx, unique)
	if err != nil {
		return nil, err
	}
	players := make([]SteamPlayer, 0, len(summaries))
	for _, summary := range summaries {
		players = append(players, summary.player())
	}
	return players, nil
}

func (s *Service) SteamAccountProfile(ctx context.Context, steamID string) (SteamAccountProfile, error) {
	if !isSteamID(steamID) {
		return SteamAccountProfile{}, ErrResourceNotFound
	}
	players, err := s.steamPlayerSummaries(ctx, []string{steamID})
	if err != nil {
		return SteamAccountProfile{}, err
	}
	if len(players) == 0 {
		return SteamAccountProfile{}, ErrResourceNotFound
	}

	profile := SteamAccountProfile{
		SteamPlayer:        players[0].player(),
		RustPlaytimeStatus: "unavailable",
		FriendsStatus:      "unavailable",
	}
	profile.RustPlaytimeMinutes, profile.RustPlaytimeStatus = s.rustPlaytime(ctx, steamID)
	profile.FriendsPlayingRust, profile.FriendsStatus = s.friendsPlayingRust(ctx, steamID)
	return profile, nil
}

func (s *Service) steamPlayerSummaries(ctx context.Context, steamIDs []string) ([]steamPlayerSummary, error) {
	if len(steamIDs) == 0 {
		return nil, nil
	}
	values := url.Values{}
	values.Set("steamids", strings.Join(steamIDs, ","))
	response, err := s.steamRequest(ctx, "/ISteamUser/GetPlayerSummaries/v0002/", values)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if err := providerResponseError(response); err != nil {
		return nil, err
	}

	var payload steamPlayerSummaryResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode Steam player summary: %w", err)
	}
	return payload.Response.Players, nil
}

func (s *Service) rustPlaytime(ctx context.Context, steamID string) (*int, string) {
	values := url.Values{}
	values.Set("steamid", steamID)
	values.Set("appids_filter", strconv.Itoa(rustSteamAppID))
	response, err := s.steamRequest(ctx, "/IPlayerService/GetOwnedGames/v0001/", values)
	if err != nil {
		return nil, "unavailable"
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return nil, "private"
	}
	if providerResponseError(response) != nil {
		return nil, "unavailable"
	}

	var payload steamOwnedGamesResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload); err != nil || payload.Response == nil {
		return nil, "unavailable"
	}
	for _, game := range payload.Response.Games {
		if game.AppID == rustSteamAppID {
			minutes := max(game.PlaytimeForever, 0)
			return &minutes, "available"
		}
	}
	return nil, "not_owned"
}

func (s *Service) friendsPlayingRust(ctx context.Context, steamID string) (*int, string) {
	values := url.Values{}
	values.Set("steamid", steamID)
	values.Set("relationship", "friend")
	response, err := s.steamRequest(ctx, "/ISteamUser/GetFriendList/v0001/", values)
	if err != nil {
		return nil, "unavailable"
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return nil, "private"
	}
	if providerResponseError(response) != nil {
		return nil, "unavailable"
	}

	var payload steamFriendListResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(&payload); err != nil || payload.FriendsList == nil {
		return nil, "unavailable"
	}
	friendIDs := make([]string, 0, len(payload.FriendsList.Friends))
	for _, friend := range payload.FriendsList.Friends {
		if isSteamID(friend.SteamID) {
			friendIDs = append(friendIDs, friend.SteamID)
		}
	}

	playingRust := 0
	for start := 0; start < len(friendIDs); start += 100 {
		end := min(start+100, len(friendIDs))
		players, err := s.steamPlayerSummaries(ctx, friendIDs[start:end])
		if err != nil {
			return nil, "unavailable"
		}
		for _, player := range players {
			if player.GameID == strconv.Itoa(rustSteamAppID) {
				playingRust++
			}
		}
	}
	return &playingRust, "available"
}

func (s *Service) resolveSteamVanity(ctx context.Context, vanity string) (string, error) {
	values := url.Values{}
	values.Set("vanityurl", vanity)
	response, err := s.steamRequest(ctx, "/ISteamUser/ResolveVanityURL/v0001/", values)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if err := providerResponseError(response); err != nil {
		return "", err
	}

	var payload steamVanityResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode Steam vanity response: %w", err)
	}
	if payload.Response.Success != 1 || !isSteamID(payload.Response.SteamID) {
		return "", ErrResourceNotFound
	}
	return payload.Response.SteamID, nil
}

func (s *Service) steamRequest(ctx context.Context, path string, values url.Values) (*http.Response, error) {
	credential, err := s.credential(ctx, ProviderSteam)
	if err != nil {
		return nil, err
	}
	values.Set("key", credential)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, steamAPIBaseURL+path+"?"+values.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("create Steam request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	response, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Steam request: %w: %v", ErrProviderUnavailable, err)
	}
	return response, nil
}

func (player steamPlayerSummary) player() SteamPlayer {
	return SteamPlayer{
		SteamID:          player.SteamID,
		DisplayName:      strings.TrimSpace(player.PersonaName),
		ProfileURL:       strings.TrimSpace(player.ProfileURL),
		AvatarURL:        strings.TrimSpace(player.AvatarFull),
		Visibility:       steamVisibility(player.CommunityVisibilityState, player.ProfileState),
		Presence:         steamPresence(player.PersonaState),
		CurrentGame:      strings.TrimSpace(player.GameExtraInfo),
		LastLogoffAt:     unixTime(player.LastLogoff),
		ProfileCreatedAt: unixTime(player.TimeCreated),
	}
}

func normalizeSteamLookup(query string) (steamID, vanity string, err error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return "", "", fmt.Errorf("enter a SteamID64, Steam profile URL, or vanity name")
	}
	if len([]rune(query)) > 160 {
		return "", "", fmt.Errorf("Steam player lookup must be at most 160 characters")
	}
	if parsed, parseErr := url.Parse(query); parseErr == nil && parsed.Hostname() == "steamcommunity.com" {
		parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
		if len(parts) >= 2 {
			switch strings.ToLower(parts[0]) {
			case "profiles":
				query = parts[1]
			case "id":
				query = parts[1]
			}
		}
	}
	query = strings.TrimPrefix(strings.TrimSpace(query), "@")
	if isSteamID(query) {
		return query, "", nil
	}
	if !isSteamVanity(query) {
		return "", "", fmt.Errorf("enter a valid SteamID64 or public Steam profile name")
	}
	return "", query, nil
}

func isSteamID(value string) bool {
	if len(value) != 17 || !strings.HasPrefix(value, "765") {
		return false
	}
	_, err := strconv.ParseUint(value, 10, 64)
	return err == nil
}

func isSteamVanity(value string) bool {
	if len(value) < 2 || len(value) > 64 {
		return false
	}
	for _, character := range value {
		if (character < 'a' || character > 'z') && (character < 'A' || character > 'Z') && (character < '0' || character > '9') && character != '-' && character != '_' {
			return false
		}
	}
	return true
}

func steamVisibility(communityVisibility, profileState int) string {
	if communityVisibility == 3 && profileState == 1 {
		return "public"
	}
	if communityVisibility == 1 || profileState == 0 {
		return "private"
	}
	return "limited"
}

func steamPresence(state int) string {
	switch state {
	case 1:
		return "online"
	case 2:
		return "busy"
	case 3:
		return "away"
	case 4:
		return "snooze"
	case 5:
		return "looking to trade"
	case 6:
		return "looking to play"
	default:
		return "offline"
	}
}

func unixTime(value int64) *time.Time {
	if value <= 0 {
		return nil
	}
	parsed := time.Unix(value, 0).UTC()
	return &parsed
}
