package integrations

import (
	"bufio"
	"os"
	"strings"
)

// ManagedCredentials are loaded by the API only. They are never serialized to clients.
type ManagedCredentials struct {
	BattleMetricsToken string
	SteamWebAPIKey     string
	VAPIDPublicKey     string
	VAPIDPrivateKey    string
	VAPIDSubject       string
}

func LoadManagedCredentials(path string) (ManagedCredentials, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return ManagedCredentials{}, nil
	}

	file, err := os.Open(path)
	if err != nil {
		return ManagedCredentials{}, err
	}
	defer file.Close()

	var credentials ManagedCredentials
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		key, value, ok := splitCredentialLine(scanner.Text())
		if !ok {
			continue
		}
		normalizedKey := normalizeCredentialKey(key)
		switch {
		case strings.Contains(normalizedKey, "battlemetrics") || normalizedKey == "bm_token":
			credentials.BattleMetricsToken = value
		case strings.Contains(normalizedKey, "steam") && (strings.Contains(normalizedKey, "api") || strings.Contains(normalizedKey, "key")):
			credentials.SteamWebAPIKey = value
		case normalizedKey == "vapid_public_key":
			credentials.VAPIDPublicKey = value
		case normalizedKey == "vapid_private_key":
			credentials.VAPIDPrivateKey = value
		case normalizedKey == "vapid_subject":
			credentials.VAPIDSubject = value
		}
	}
	if err := scanner.Err(); err != nil {
		return ManagedCredentials{}, err
	}
	return credentials, nil
}

func splitCredentialLine(line string) (string, string, bool) {
	line = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "- "))
	if line == "" || strings.HasPrefix(line, "#") {
		return "", "", false
	}

	separators := []string{"=", ":", " - "}
	for _, separator := range separators {
		index := strings.Index(line, separator)
		if index < 1 {
			continue
		}
		key := strings.TrimSpace(line[:index])
		value := strings.Trim(strings.TrimSpace(line[index+len(separator):]), "\"'`")
		if key == "" || value == "" {
			return "", "", false
		}
		return key, value, true
	}
	return "", "", false
}

func normalizeCredentialKey(key string) string {
	key = strings.ToLower(strings.TrimSpace(key))
	key = strings.NewReplacer("-", "_", " ", "_", "/", "_").Replace(key)
	return strings.Trim(key, "_")
}
