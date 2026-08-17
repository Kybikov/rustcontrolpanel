package storage

import (
	"context"
	"fmt"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Clients struct {
	DB           *pgxpool.Pool
	Redis        *redis.Client
	redisEnabled bool
}

func Open(ctx context.Context, cfg config.Config) (*Clients, error) {
	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("create postgres pool: %w", err)
	}
	if err := db.Ping(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	clients := &Clients{DB: db, redisEnabled: cfg.RedisEnabled}
	if !cfg.RedisEnabled {
		return clients, nil
	}

	redisOptions, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	clients.Redis = redis.NewClient(redisOptions)
	if err := clients.Redis.Ping(ctx).Err(); err != nil {
		clients.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	return clients, nil
}

func (c *Clients) Ready(ctx context.Context) map[string]bool {
	ready := map[string]bool{"postgres": false, "redis": true}
	if c == nil {
		return ready
	}
	if c.DB != nil {
		ready["postgres"] = c.DB.Ping(ctx) == nil
	}
	if c.redisEnabled {
		ready["redis"] = c.Redis != nil && c.Redis.Ping(ctx).Err() == nil
	}
	return ready
}

func (c *Clients) Close() {
	if c == nil {
		return
	}
	if c.Redis != nil {
		_ = c.Redis.Close()
	}
	if c.DB != nil {
		c.DB.Close()
	}
}
