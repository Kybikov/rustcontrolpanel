package integrations

import (
	"encoding/json"
	"testing"
	"time"
)

func TestBattleMetricsServerRustServer(t *testing.T) {
	lastSeen := time.Date(2026, time.August, 21, 13, 45, 0, 0, time.UTC)
	details := json.RawMessage(`{
		"rust_map": "Procedural Map",
		"rust_map_size": "4250",
		"rust_description": "Vanilla monthly",
		"rust_last_wipe": 1787313600
	}`)

	server := battleMetricsServer{
		ID: "123456",
		Attributes: battleMetricsServerAttributes{
			Name:       "Example Rust",
			Address:    "127.0.0.1:28015",
			IP:         "127.0.0.1",
			Port:       28015,
			Players:    42,
			MaxPlayers: 200,
			Rank:       17,
			Status:     "online",
			Details:    details,
			LastSeen:   &lastSeen,
		},
	}.rustServer()

	if server.ID != "123456" || server.Map != "Procedural Map" || server.MapSize != 4250 || server.Description != "Vanilla monthly" {
		t.Fatalf("unexpected mapped server: %#v", server)
	}
	if server.LastSeenAt == nil || !server.LastSeenAt.Equal(lastSeen) {
		t.Fatalf("expected last seen %s, got %#v", lastSeen, server.LastSeenAt)
	}
	if server.WipeAt == nil || server.WipeAt.Unix() != 1787313600 {
		t.Fatalf("unexpected wipe time: %#v", server.WipeAt)
	}
}

func TestBattleMetricsServerRustServerAcceptsRFC3339Wipe(t *testing.T) {
	server := battleMetricsServer{
		Attributes: battleMetricsServerAttributes{Details: json.RawMessage(`{"rust_last_wipe":"2026-08-20T12:30:00Z"}`)},
	}.rustServer()

	if server.WipeAt == nil || server.WipeAt.Format(time.RFC3339) != "2026-08-20T12:30:00Z" {
		t.Fatalf("unexpected wipe time: %#v", server.WipeAt)
	}
}

func TestIsNumericID(t *testing.T) {
	for _, value := range []string{"1", "12345678901234567890"} {
		if !isNumericID(value) {
			t.Fatalf("expected %q to be accepted", value)
		}
	}
	for _, value := range []string{"", "-1", "abc", "12/34", "123456789012345678901"} {
		if isNumericID(value) {
			t.Fatalf("expected %q to be rejected", value)
		}
	}
}
