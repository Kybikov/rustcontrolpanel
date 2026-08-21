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

const battleMetricsServersURL = "https://api.battlemetrics.com/servers"

type ServerSearchResult struct {
	Servers []RustServer `json:"servers"`
	Page    int          `json:"page"`
	PerPage int          `json:"perPage"`
	HasMore bool         `json:"hasMore"`
}

type RustServer struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Address     string     `json:"address"`
	IP          string     `json:"ip"`
	Port        int        `json:"port"`
	Players     int        `json:"players"`
	MaxPlayers  int        `json:"maxPlayers"`
	Rank        int        `json:"rank,omitempty"`
	Status      string     `json:"status"`
	Map         string     `json:"map,omitempty"`
	MapSize     int        `json:"mapSize,omitempty"`
	Description string     `json:"description,omitempty"`
	WipeAt      *time.Time `json:"wipeAt,omitempty"`
	LastSeenAt  *time.Time `json:"lastSeenAt,omitempty"`
}

type battleMetricsServerResponse struct {
	Data  []battleMetricsServer `json:"data"`
	Links struct {
		Next string `json:"next"`
	} `json:"links"`
}

type battleMetricsServer struct {
	ID         string                        `json:"id"`
	Attributes battleMetricsServerAttributes `json:"attributes"`
}

type battleMetricsServerAttributes struct {
	Name       string          `json:"name"`
	Address    string          `json:"address"`
	IP         string          `json:"ip"`
	Port       int             `json:"port"`
	Players    int             `json:"players"`
	MaxPlayers int             `json:"maxPlayers"`
	Rank       int             `json:"rank"`
	Status     string          `json:"status"`
	Details    json.RawMessage `json:"details"`
	LastSeen   *time.Time      `json:"lastSeen"`
	UpdatedAt  *time.Time      `json:"updatedAt"`
}

func (s *Service) SearchRustServers(ctx context.Context, query string, page, perPage int) (ServerSearchResult, error) {
	page = max(page, 1)
	perPage = min(max(perPage, 1), 50)
	query = strings.TrimSpace(query)
	if len([]rune(query)) > 120 {
		return ServerSearchResult{}, fmt.Errorf("server search query must be at most 120 characters")
	}

	values := url.Values{}
	values.Set("filter[game]", "rust")
	values.Set("page[size]", strconv.Itoa(perPage))
	values.Set("page[offset]", strconv.Itoa((page-1)*perPage))
	values.Set("sort", "-players")
	values.Set("fields[server]", "name,address,ip,port,players,maxPlayers,rank,status,details,lastSeen,updatedAt")
	if query != "" {
		values.Set("filter[search]", query)
	}

	response, err := s.battleMetricsRequest(ctx, battleMetricsServersURL+"?"+values.Encode())
	if err != nil {
		return ServerSearchResult{}, err
	}
	defer response.Body.Close()

	if err := providerResponseError(response); err != nil {
		return ServerSearchResult{}, err
	}
	var payload battleMetricsServerResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 4<<20)).Decode(&payload); err != nil {
		return ServerSearchResult{}, fmt.Errorf("decode BattleMetrics servers: %w", err)
	}

	servers := make([]RustServer, 0, len(payload.Data))
	for _, item := range payload.Data {
		servers = append(servers, item.rustServer())
	}
	return ServerSearchResult{Servers: servers, Page: page, PerPage: perPage, HasMore: strings.TrimSpace(payload.Links.Next) != ""}, nil
}

func (s *Service) RustServer(ctx context.Context, serverID string) (RustServer, error) {
	serverID = strings.TrimSpace(serverID)
	if !isNumericID(serverID) {
		return RustServer{}, fmt.Errorf("invalid BattleMetrics server id")
	}
	response, err := s.battleMetricsRequest(ctx, battleMetricsServersURL+"/"+serverID)
	if err != nil {
		return RustServer{}, err
	}
	defer response.Body.Close()
	if err := providerResponseError(response); err != nil {
		return RustServer{}, err
	}
	var payload struct {
		Data battleMetricsServer `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(&payload); err != nil {
		return RustServer{}, fmt.Errorf("decode BattleMetrics server: %w", err)
	}
	return payload.Data.rustServer(), nil
}

func (s *Service) battleMetricsRequest(ctx context.Context, endpoint string) (*http.Response, error) {
	credential, err := s.credential(ctx, ProviderBattleMetrics)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create BattleMetrics request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+credential)
	response, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("BattleMetrics request: %w: %v", ErrProviderUnavailable, err)
	}
	return response, nil
}

func providerResponseError(response *http.Response) error {
	if response.StatusCode == http.StatusUnauthorized || response.StatusCode == http.StatusForbidden {
		return ErrInvalidCredential
	}
	if response.StatusCode == http.StatusTooManyRequests || response.StatusCode >= http.StatusInternalServerError {
		return ErrProviderUnavailable
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return ErrProviderRejected
	}
	return nil
}

func (server battleMetricsServer) rustServer() RustServer {
	result := RustServer{
		ID:         server.ID,
		Name:       server.Attributes.Name,
		Address:    server.Attributes.Address,
		IP:         server.Attributes.IP,
		Port:       server.Attributes.Port,
		Players:    server.Attributes.Players,
		MaxPlayers: server.Attributes.MaxPlayers,
		Rank:       server.Attributes.Rank,
		Status:     server.Attributes.Status,
		LastSeenAt: firstTime(server.Attributes.LastSeen, server.Attributes.UpdatedAt),
	}
	var details map[string]any
	if len(server.Attributes.Details) == 0 || json.Unmarshal(server.Attributes.Details, &details) != nil {
		return result
	}
	result.Map = stringDetail(details, "rust_map", "map")
	result.MapSize = intDetail(details, "rust_map_size", "map_size")
	result.Description = stringDetail(details, "rust_description", "description")
	result.WipeAt = timeDetail(details, "rust_last_wipe", "rust_last_wipe_ent")
	return result
}

func stringDetail(details map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := details[key].(string); ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func intDetail(details map[string]any, keys ...string) int {
	for _, key := range keys {
		switch value := details[key].(type) {
		case float64:
			return int(value)
		case string:
			if number, err := strconv.Atoi(value); err == nil {
				return number
			}
		}
	}
	return 0
}

func timeDetail(details map[string]any, keys ...string) *time.Time {
	for _, key := range keys {
		value, ok := details[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case string:
			if parsed, err := time.Parse(time.RFC3339, typed); err == nil {
				return &parsed
			}
		case float64:
			parsed := time.Unix(int64(typed), 0).UTC()
			return &parsed
		}
	}
	return nil
}

func firstTime(values ...*time.Time) *time.Time {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func isNumericID(value string) bool {
	if value == "" || len(value) > 20 {
		return false
	}
	for _, character := range value {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}
