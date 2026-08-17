package integrations

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidProvider     = errors.New("unsupported integration provider")
	ErrNotConfigured       = errors.New("integration is not configured")
	ErrInvalidCredential   = errors.New("provider rejected credentials")
	ErrProviderUnavailable = errors.New("provider is unavailable")
	ErrProviderRejected    = errors.New("provider rejected the request")
)

const (
	ProviderBattleMetrics = "battlemetrics"
	ProviderSteam         = "steam"
)

var providers = []string{ProviderBattleMetrics, ProviderSteam}

type Status struct {
	Provider      string     `json:"provider"`
	Connected     bool       `json:"connected"`
	LastCheckedAt *time.Time `json:"lastCheckedAt,omitempty"`
	LastError     string     `json:"lastError,omitempty"`
}

type Service struct {
	db         *pgxpool.Pool
	key        []byte
	httpClient *http.Client
}

type storedCredential struct {
	Value string `json:"value"`
}

func NewService(db *pgxpool.Pool, encryptionSecret string) (*Service, error) {
	if db == nil {
		return nil, errors.New("integration database is not configured")
	}
	if strings.TrimSpace(encryptionSecret) == "" {
		return nil, errors.New("INTEGRATIONS_ENCRYPTION_KEY must be configured")
	}
	hash := sha256.Sum256([]byte(encryptionSecret))
	return &Service{
		db:  db,
		key: hash[:],
		httpClient: &http.Client{
			Timeout: 12 * time.Second,
		},
	}, nil
}

func (s *Service) EnsureSchema(ctx context.Context) error {
	statements := []string{
		`CREATE SCHEMA IF NOT EXISTS control`,
		`CREATE TABLE IF NOT EXISTS control.integrations (
			provider TEXT PRIMARY KEY,
			credentials BYTEA NOT NULL,
			connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			last_checked_at TIMESTAMPTZ,
			last_error TEXT NOT NULL DEFAULT ''
		)`,
	}
	for _, statement := range statements {
		if _, err := s.db.Exec(ctx, statement); err != nil {
			return fmt.Errorf("apply integrations schema: %w", err)
		}
	}
	return nil
}

func (s *Service) List(ctx context.Context) ([]Status, error) {
	statusByProvider := make(map[string]Status, len(providers))
	rows, err := s.db.Query(ctx, `
		SELECT provider, last_checked_at, last_error
		FROM control.integrations
	`)
	if err != nil {
		return nil, fmt.Errorf("list integrations: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var status Status
		if err := rows.Scan(&status.Provider, &status.LastCheckedAt, &status.LastError); err != nil {
			return nil, fmt.Errorf("scan integration: %w", err)
		}
		status.Connected = true
		statusByProvider[status.Provider] = status
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate integrations: %w", err)
	}

	result := make([]Status, 0, len(providers))
	for _, provider := range providers {
		status, ok := statusByProvider[provider]
		if !ok {
			status = Status{Provider: provider}
		}
		result = append(result, status)
	}
	return result, nil
}

func (s *Service) Connect(ctx context.Context, provider, credential string) (Status, error) {
	provider, err := normalizeProvider(provider)
	if err != nil {
		return Status{}, err
	}
	credential = normalizeCredential(provider, credential)
	if credential == "" {
		return Status{}, ErrInvalidCredential
	}
	if err := s.checkProvider(ctx, provider, credential); err != nil {
		return Status{}, err
	}

	payload, err := json.Marshal(storedCredential{Value: credential})
	if err != nil {
		return Status{}, fmt.Errorf("encode integration credential: %w", err)
	}
	ciphertext, err := s.encrypt(payload)
	if err != nil {
		return Status{}, fmt.Errorf("encrypt integration credential: %w", err)
	}
	_, err = s.db.Exec(ctx, `
		INSERT INTO control.integrations (provider, credentials, connected_at, last_checked_at, last_error)
		VALUES ($1, $2, NOW(), NOW(), '')
		ON CONFLICT (provider) DO UPDATE SET
			credentials = EXCLUDED.credentials,
			connected_at = NOW(),
			last_checked_at = NOW(),
			last_error = ''
	`, provider, ciphertext)
	if err != nil {
		return Status{}, fmt.Errorf("save integration: %w", err)
	}
	return s.status(ctx, provider)
}

func (s *Service) Test(ctx context.Context, provider string) (Status, error) {
	provider, err := normalizeProvider(provider)
	if err != nil {
		return Status{}, err
	}
	credential, err := s.credential(ctx, provider)
	if errors.Is(err, ErrNotConfigured) {
		return Status{Provider: provider}, err
	}
	if err != nil {
		return Status{}, err
	}

	checkErr := s.checkProvider(ctx, provider, credential)
	lastError := ""
	if checkErr != nil {
		lastError = safeError(checkErr)
	}
	_, updateErr := s.db.Exec(ctx, `
		UPDATE control.integrations
		SET last_checked_at = NOW(), last_error = $1
		WHERE provider = $2
	`, lastError, provider)
	if updateErr != nil {
		return Status{}, fmt.Errorf("update integration status: %w", updateErr)
	}
	status, statusErr := s.status(ctx, provider)
	if statusErr != nil {
		return Status{}, statusErr
	}
	return status, checkErr
}

func (s *Service) Disconnect(ctx context.Context, provider string) error {
	provider, err := normalizeProvider(provider)
	if err != nil {
		return err
	}
	if _, err := s.db.Exec(ctx, `DELETE FROM control.integrations WHERE provider = $1`, provider); err != nil {
		return fmt.Errorf("disconnect integration: %w", err)
	}
	return nil
}

func (s *Service) status(ctx context.Context, provider string) (Status, error) {
	var status Status
	status.Provider = provider
	err := s.db.QueryRow(ctx, `
		SELECT last_checked_at, last_error
		FROM control.integrations WHERE provider = $1
	`, provider).Scan(&status.LastCheckedAt, &status.LastError)
	if errors.Is(err, pgx.ErrNoRows) {
		return status, nil
	}
	if err != nil {
		return Status{}, fmt.Errorf("load integration status: %w", err)
	}
	status.Connected = true
	return status, nil
}

func (s *Service) credential(ctx context.Context, provider string) (string, error) {
	var ciphertext []byte
	err := s.db.QueryRow(ctx, `SELECT credentials FROM control.integrations WHERE provider = $1`, provider).Scan(&ciphertext)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotConfigured
	}
	if err != nil {
		return "", fmt.Errorf("load integration credential: %w", err)
	}
	plaintext, err := s.decrypt(ciphertext)
	if err != nil {
		return "", fmt.Errorf("decrypt integration credential: %w", err)
	}
	var credential storedCredential
	if err := json.Unmarshal(plaintext, &credential); err != nil {
		return "", fmt.Errorf("decode integration credential: %w", err)
	}
	return credential.Value, nil
}

func (s *Service) checkProvider(ctx context.Context, provider, credential string) error {
	var endpoint string
	request := func() (*http.Request, error) {
		switch provider {
		case ProviderBattleMetrics:
			endpoint = "https://api.battlemetrics.com/servers?page[size]=1&filter[game]=rust"
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
			if err == nil {
				req.Header.Set("Accept", "application/json")
				req.Header.Set("Authorization", "Bearer "+credential)
			}
			return req, err
		case ProviderSteam:
			query := url.Values{}
			query.Set("key", credential)
			query.Set("format", "json")
			endpoint = "https://api.steampowered.com/ISteamWebAPIUtil/GetSupportedAPIList/v0001/?" + query.Encode()
			return http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		default:
			return nil, ErrInvalidProvider
		}
	}

	req, err := request()
	if err != nil {
		return fmt.Errorf("create provider request: %w", err)
	}
	response, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("provider request: %w: %v", ErrProviderUnavailable, err)
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, response.Body)
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

func (s *Service) encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func (s *Service) decrypt(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(ciphertext) < gcm.NonceSize() {
		return nil, errors.New("invalid encrypted credential")
	}
	nonce, payload := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	return gcm.Open(nil, nonce, payload, nil)
}

func normalizeProvider(provider string) (string, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	for _, supported := range providers {
		if provider == supported {
			return provider, nil
		}
	}
	return "", ErrInvalidProvider
}

func normalizeCredential(provider, credential string) string {
	credential = strings.TrimSpace(credential)
	if provider == ProviderBattleMetrics {
		credential = strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(credential, "Bearer "), "bearer "))
	}
	return credential
}

func safeError(err error) string {
	switch {
	case errors.Is(err, ErrInvalidCredential):
		return "Provider rejected the credential"
	case errors.Is(err, ErrProviderUnavailable):
		return "Provider is temporarily unavailable"
	case errors.Is(err, ErrProviderRejected):
		return "Provider rejected the request"
	default:
		return "Connection check failed"
	}
}
