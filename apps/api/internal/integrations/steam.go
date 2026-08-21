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
	LastLogoff               int64  `json:"lastlogoff"`
	TimeCreated              int64  `json:"timecreated"`
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

	values := url.Values{}
	values.Set("steamids", steamID)
	response, err := s.steamRequest(ctx, "/ISteamUser/GetPlayerSummaries/v0002/", values)
	if err != nil {
		return SteamPlayer{}, err
	}
	defer response.Body.Close()
	if err := providerResponseError(response); err != nil {
		return SteamPlayer{}, err
	}

	var payload steamPlayerSummaryResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&payload); err != nil {
		return SteamPlayer{}, fmt.Errorf("decode Steam player summary: %w", err)
	}
	if len(payload.Response.Players) == 0 {
		return SteamPlayer{}, ErrResourceNotFound
	}
	return payload.Response.Players[0].player(), nil
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
