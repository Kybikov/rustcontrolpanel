package integrations

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadManagedCredentials(t *testing.T) {
	path := filepath.Join(t.TempDir(), "keys.txt")
	contents := "provider notes\nbattlemetrics - bm-secret\nSTEAM_WEB_API_KEY=steam-secret\n# ignored = value\n"
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}

	credentials, err := LoadManagedCredentials(path)
	if err != nil {
		t.Fatal(err)
	}
	if credentials.BattleMetricsToken != "bm-secret" {
		t.Fatalf("unexpected BattleMetrics token: %q", credentials.BattleMetricsToken)
	}
	if credentials.SteamWebAPIKey != "steam-secret" {
		t.Fatalf("unexpected Steam key: %q", credentials.SteamWebAPIKey)
	}
}
