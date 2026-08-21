package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestSteamOpenIDLoginURL(t *testing.T) {
	returnTo := "http://localhost:8080/api/v1/auth/steam/callback?state=secure-state"
	loginURL, err := steamOpenIDLoginURL(returnTo)
	if err != nil {
		t.Fatalf("steamOpenIDLoginURL() error = %v", err)
	}
	parsed, err := url.Parse(loginURL)
	if err != nil {
		t.Fatalf("parse login URL: %v", err)
	}
	if parsed.Hostname() != "steamcommunity.com" || parsed.Path != "/openid/login" {
		t.Fatalf("unexpected Steam endpoint: %s", loginURL)
	}
	if got := parsed.Query().Get("openid.return_to"); got != returnTo {
		t.Fatalf("return_to = %q, want %q", got, returnTo)
	}
	if got := parsed.Query().Get("openid.mode"); got != "checkid_setup" {
		t.Fatalf("mode = %q", got)
	}
}

func TestSteamIDFromClaimedID(t *testing.T) {
	steamID, err := steamIDFromClaimedID("https://steamcommunity.com/openid/id/76561198000000000")
	if err != nil {
		t.Fatalf("steamIDFromClaimedID() error = %v", err)
	}
	if steamID != "76561198000000000" {
		t.Fatalf("steamID = %q", steamID)
	}
	if _, err := steamIDFromClaimedID("https://example.com/openid/id/76561198000000000"); err == nil {
		t.Fatal("expected invalid host to fail")
	}
}

func TestVerifySteamOpenID(t *testing.T) {
	verified := false
	verifier := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse verification form: %v", err)
		}
		if r.Form.Get("openid.mode") != "check_authentication" {
			t.Fatalf("mode = %q", r.Form.Get("openid.mode"))
		}
		verified = true
		_, _ = w.Write([]byte("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n"))
	}))
	defer verifier.Close()

	returnTo := "http://localhost:8080/api/v1/auth/steam/callback?state=secure-state"
	values := url.Values{
		"openid.ns":          {"http://specs.openid.net/auth/2.0"},
		"openid.mode":        {"id_res"},
		"openid.op_endpoint": {"https://steamcommunity.com/openid"},
		"openid.return_to":   {returnTo},
		"openid.claimed_id":  {"https://steamcommunity.com/openid/id/76561198000000000"},
	}
	steamID, err := verifySteamOpenID(context.Background(), verifier.Client(), verifier.URL, values, returnTo)
	if err != nil {
		t.Fatalf("verifySteamOpenID() error = %v", err)
	}
	if !verified || steamID != "76561198000000000" {
		t.Fatalf("verified=%v steamID=%q", verified, steamID)
	}
}
