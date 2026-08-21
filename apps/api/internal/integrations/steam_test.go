package integrations

import (
	"testing"
	"time"
)

func TestNormalizeSteamLookup(t *testing.T) {
	tests := []struct {
		name      string
		query     string
		steamID   string
		vanity    string
		shouldErr bool
	}{
		{name: "steam id", query: "76561198000000000", steamID: "76561198000000000"},
		{name: "profile url", query: "https://steamcommunity.com/profiles/76561198000000000/", steamID: "76561198000000000"},
		{name: "vanity url", query: "https://steamcommunity.com/id/rust_player/", vanity: "rust_player"},
		{name: "vanity name", query: "rust-player", vanity: "rust-player"},
		{name: "invalid", query: "not a Steam profile", shouldErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			steamID, vanity, err := normalizeSteamLookup(test.query)
			if test.shouldErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeSteamLookup() error = %v", err)
			}
			if steamID != test.steamID || vanity != test.vanity {
				t.Fatalf("got steamID=%q vanity=%q", steamID, vanity)
			}
		})
	}
}

func TestSteamPlayerMapping(t *testing.T) {
	player := steamPlayerSummary{
		SteamID:                  "76561198000000000",
		CommunityVisibilityState: 3,
		ProfileState:             1,
		PersonaName:              "Rust Player",
		PersonaState:             1,
		GameExtraInfo:            "Rust",
		LastLogoff:               1787313600,
		TimeCreated:              1600000000,
	}.player()

	if player.Visibility != "public" || player.Presence != "online" || player.CurrentGame != "Rust" {
		t.Fatalf("unexpected player: %#v", player)
	}
	if player.LastLogoffAt == nil || player.LastLogoffAt.Unix() != 1787313600 {
		t.Fatalf("unexpected last logoff: %#v", player.LastLogoffAt)
	}
	if player.ProfileCreatedAt == nil || !player.ProfileCreatedAt.Equal(time.Unix(1600000000, 0).UTC()) {
		t.Fatalf("unexpected profile creation: %#v", player.ProfileCreatedAt)
	}
}
