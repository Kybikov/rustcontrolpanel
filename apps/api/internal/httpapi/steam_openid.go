package httpapi

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/auth"
)

const steamOpenIDVerifyURL = "https://steamcommunity.com/openid/login"

var steamOpenIDHTTPClient = &http.Client{Timeout: 12 * time.Second}

func (s *server) startSteamLink(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requireAuth(w, r, "")
	if !ok {
		return
	}
	returnTo, err := steamReturnToURL(s.cfg.PublicAPIURL, "")
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Steam linking is not configured for this environment"})
		return
	}
	state, err := s.auth.CreateSteamLinkState(r.Context(), actor.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not start Steam linking"})
		return
	}
	returnTo, err = steamReturnToURL(s.cfg.PublicAPIURL, state)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Steam linking is not configured for this environment"})
		return
	}
	loginURL, err := steamOpenIDLoginURL(returnTo)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not start Steam linking"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": loginURL})
}

func (s *server) completeSteamLink(w http.ResponseWriter, r *http.Request) {
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	if _, err := s.auth.SteamLinkStateUser(r.Context(), state); err != nil {
		s.redirectSteamAccount(w, r, "error")
		return
	}
	returnTo, err := steamReturnToURL(s.cfg.PublicAPIURL, state)
	if err != nil {
		s.redirectSteamAccount(w, r, "error")
		return
	}
	steamID, err := verifySteamOpenID(r.Context(), steamOpenIDHTTPClient, steamOpenIDVerifyURL, r.URL.Query(), returnTo)
	if err != nil {
		s.redirectSteamAccount(w, r, "error")
		return
	}
	if _, err := s.auth.LinkSteamAccount(r.Context(), state, steamID); err != nil {
		s.redirectSteamAccount(w, r, "error")
		return
	}
	s.redirectSteamAccount(w, r, "connected")
}

func (s *server) steamAccount(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requireAuth(w, r, "")
	if !ok {
		return
	}
	account, err := s.auth.SteamAccount(r.Context(), actor.ID)
	if errors.Is(err, auth.ErrSteamNotLinked) {
		writeJSON(w, http.StatusOK, map[string]any{"steam": nil})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not load Steam account"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"steam": account})
}

func (s *server) unlinkSteamAccount(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.requireAuth(w, r, "")
	if !ok {
		return
	}
	if err := s.auth.UnlinkSteamAccount(r.Context(), actor.ID); err != nil && !errors.Is(err, auth.ErrSteamNotLinked) {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not disconnect Steam account"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "disconnected"})
}

func (s *server) redirectSteamAccount(w http.ResponseWriter, r *http.Request, state string) {
	target, err := steamAccountURL(s.cfg.PublicWebURL, state)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Steam linking could not be completed"})
		return
	}
	http.Redirect(w, r, target, http.StatusSeeOther)
}

func steamOpenIDLoginURL(returnTo string) (string, error) {
	returnToURL, err := url.Parse(returnTo)
	if err != nil || returnToURL.Scheme == "" || returnToURL.Host == "" {
		return "", errors.New("invalid Steam return URL")
	}
	endpoint, err := url.Parse(steamOpenIDVerifyURL)
	if err != nil {
		return "", fmt.Errorf("parse Steam OpenID endpoint: %w", err)
	}
	identifier := "http://specs.openid.net/auth/2.0/identifier_select"
	values := endpoint.Query()
	values.Set("openid.ns", "http://specs.openid.net/auth/2.0")
	values.Set("openid.mode", "checkid_setup")
	values.Set("openid.return_to", returnToURL.String())
	values.Set("openid.realm", returnToURL.Scheme+"://"+returnToURL.Host)
	values.Set("openid.identity", identifier)
	values.Set("openid.claimed_id", identifier)
	endpoint.RawQuery = values.Encode()
	return endpoint.String(), nil
}

func steamReturnToURL(publicAPIURL, state string) (string, error) {
	endpoint, err := url.Parse(strings.TrimSpace(publicAPIURL))
	if err != nil || endpoint.Scheme == "" || endpoint.Host == "" {
		return "", errors.New("invalid public API URL")
	}
	endpoint.Path = strings.TrimRight(endpoint.Path, "/") + "/api/v1/auth/steam/callback"
	values := endpoint.Query()
	if strings.TrimSpace(state) != "" {
		values.Set("state", state)
	}
	endpoint.RawQuery = values.Encode()
	return endpoint.String(), nil
}

func steamAccountURL(publicWebURL, outcome string) (string, error) {
	target, err := url.Parse(strings.TrimSpace(publicWebURL))
	if err != nil || target.Scheme == "" || target.Host == "" {
		return "", errors.New("invalid public web URL")
	}
	target.Path = strings.TrimRight(target.Path, "/") + "/account"
	values := target.Query()
	values.Set("steam", outcome)
	target.RawQuery = values.Encode()
	return target.String(), nil
}

func verifySteamOpenID(ctx context.Context, client *http.Client, endpoint string, values url.Values, expectedReturnTo string) (string, error) {
	if values.Get("openid.ns") != "http://specs.openid.net/auth/2.0" || values.Get("openid.mode") != "id_res" {
		return "", errors.New("Steam OpenID response is invalid")
	}
	if !isSteamOpenIDEndpoint(values.Get("openid.op_endpoint")) || values.Get("openid.return_to") != expectedReturnTo {
		return "", errors.New("Steam OpenID response does not match this request")
	}
	steamID, err := steamIDFromClaimedID(values.Get("openid.claimed_id"))
	if err != nil {
		return "", err
	}
	verificationValues := copyOpenIDValues(values)
	verificationValues.Set("openid.mode", "check_authentication")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(verificationValues.Encode()))
	if err != nil {
		return "", fmt.Errorf("create Steam OpenID verification: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("verify Steam OpenID: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return "", errors.New("Steam OpenID verification was rejected")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 4096))
	if err != nil || !strings.Contains(string(body), "is_valid:true") {
		return "", errors.New("Steam OpenID verification failed")
	}
	return steamID, nil
}

func copyOpenIDValues(values url.Values) url.Values {
	copyValues := make(url.Values, len(values))
	for key, value := range values {
		copyValues[key] = append([]string(nil), value...)
	}
	return copyValues
}

func isSteamOpenIDEndpoint(value string) bool {
	endpoint, err := url.Parse(strings.TrimSpace(value))
	if err != nil || endpoint.Scheme != "https" || endpoint.Hostname() != "steamcommunity.com" {
		return false
	}
	// Steam returns its signed assertion with /openid/login as the OP endpoint.
	// Keep the allowed paths explicit so the response is still bound to Steam
	// while accepting the endpoint used by the actual authentication flow.
	return endpoint.Path == "/openid" || endpoint.Path == "/openid/" || endpoint.Path == "/openid/login"
}

func steamIDFromClaimedID(value string) (string, error) {
	claimedID, err := url.Parse(strings.TrimSpace(value))
	if err != nil || (claimedID.Scheme != "http" && claimedID.Scheme != "https") || claimedID.Hostname() != "steamcommunity.com" {
		return "", errors.New("Steam claimed ID is invalid")
	}
	const prefix = "/openid/id/"
	if !strings.HasPrefix(claimedID.Path, prefix) {
		return "", errors.New("Steam claimed ID is invalid")
	}
	steamID := strings.TrimPrefix(claimedID.Path, prefix)
	if strings.Contains(steamID, "/") || !steamID64(steamID) {
		return "", errors.New("Steam claimed ID is invalid")
	}
	return steamID, nil
}

func steamID64(value string) bool {
	if len(value) != 17 || !strings.HasPrefix(value, "765") {
		return false
	}
	for _, character := range value {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}
