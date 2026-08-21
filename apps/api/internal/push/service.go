package push

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Config struct {
	PublicKey  string
	PrivateKey string
	Subject    string
}

type Subscription struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

type Payload struct {
	Title string `json:"title"`
	Body  string `json:"body,omitempty"`
	Href  string `json:"href,omitempty"`
	Tag   string `json:"tag,omitempty"`
}

type Service struct {
	db  *pgxpool.Pool
	cfg Config
}

func NewService(db *pgxpool.Pool, cfg Config) *Service {
	return &Service{
		db: db,
		cfg: Config{
			PublicKey:  strings.TrimSpace(cfg.PublicKey),
			PrivateKey: strings.TrimSpace(cfg.PrivateKey),
			Subject:    strings.TrimSpace(cfg.Subject),
		},
	}
}

func (s *Service) Configured() bool {
	return s != nil && s.db != nil && s.cfg.PublicKey != "" && s.cfg.PrivateKey != "" && s.cfg.Subject != ""
}

func (s *Service) PublicKey() string {
	if !s.Configured() {
		return ""
	}
	return s.cfg.PublicKey
}

func (s *Service) EnsureSchema(ctx context.Context) error {
	if s == nil || s.db == nil {
		return errors.New("push database is not configured")
	}
	statements := []string{
		`CREATE SCHEMA IF NOT EXISTS control`,
		`CREATE TABLE IF NOT EXISTS control.web_push_subscriptions (
			endpoint TEXT PRIMARY KEY,
			user_id BIGINT NOT NULL REFERENCES control.users(id) ON DELETE CASCADE,
			p256dh TEXT NOT NULL,
			auth TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_idx ON control.web_push_subscriptions (user_id)`,
	}
	for _, statement := range statements {
		if _, err := s.db.Exec(ctx, statement); err != nil {
			return fmt.Errorf("apply web push schema: %w", err)
		}
	}
	return nil
}

func (s *Service) Subscribe(ctx context.Context, userID int64, subscription Subscription) error {
	if !s.Configured() {
		return errors.New("push notifications are not configured")
	}
	if err := validateSubscription(subscription); err != nil {
		return err
	}
	if _, err := s.db.Exec(ctx, `
		INSERT INTO control.web_push_subscriptions (endpoint, user_id, p256dh, auth)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (endpoint) DO UPDATE SET
			user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = NOW()
	`, subscription.Endpoint, userID, subscription.Keys.P256dh, subscription.Keys.Auth); err != nil {
		return fmt.Errorf("save web push subscription: %w", err)
	}
	return nil
}

func (s *Service) Unsubscribe(ctx context.Context, userID int64, endpoint string) error {
	if s == nil || s.db == nil {
		return errors.New("push database is not configured")
	}
	if _, err := s.db.Exec(ctx, `
		DELETE FROM control.web_push_subscriptions WHERE endpoint = $1 AND user_id = $2
	`, strings.TrimSpace(endpoint), userID); err != nil {
		return fmt.Errorf("remove web push subscription: %w", err)
	}
	return nil
}

func (s *Service) SendToUser(ctx context.Context, userID int64, payload Payload) {
	if !s.Configured() {
		return
	}
	message, err := json.Marshal(payload)
	if err != nil {
		return
	}
	rows, err := s.db.Query(ctx, `
		SELECT endpoint, p256dh, auth FROM control.web_push_subscriptions WHERE user_id = $1
	`, userID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var subscription webpush.Subscription
		if err := rows.Scan(&subscription.Endpoint, &subscription.Keys.P256dh, &subscription.Keys.Auth); err != nil {
			continue
		}
		sendCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		response, err := webpush.SendNotificationWithContext(sendCtx, message, &subscription, &webpush.Options{
			Subscriber:      s.cfg.Subject,
			VAPIDPublicKey:  s.cfg.PublicKey,
			VAPIDPrivateKey: s.cfg.PrivateKey,
			TTL:             120,
		})
		cancel()
		if response != nil {
			status := response.StatusCode
			_ = response.Body.Close()
			if status == http.StatusGone || status == http.StatusNotFound {
				_, _ = s.db.Exec(ctx, `DELETE FROM control.web_push_subscriptions WHERE endpoint = $1`, subscription.Endpoint)
			}
		}
		_ = err
	}
}

func validateSubscription(subscription Subscription) error {
	endpoint, err := url.Parse(strings.TrimSpace(subscription.Endpoint))
	if err != nil || endpoint.Scheme != "https" || endpoint.Host == "" {
		return errors.New("invalid push subscription endpoint")
	}
	if strings.TrimSpace(subscription.Keys.P256dh) == "" || strings.TrimSpace(subscription.Keys.Auth) == "" {
		return errors.New("invalid push subscription keys")
	}
	return nil
}
