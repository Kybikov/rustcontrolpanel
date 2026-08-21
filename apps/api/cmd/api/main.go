package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/auth"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/config"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/httpapi"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/integrations"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/playerstore"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/push"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/realtime"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/servercheck"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/storage"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("load configuration", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	clients, err := storage.Open(ctx, cfg)
	if err != nil {
		logger.Error("connect to dependencies", "error", err)
		os.Exit(1)
	}
	defer clients.Close()

	authService := auth.NewService(clients.DB)
	if err := authService.EnsureSchema(ctx); err != nil {
		logger.Error("prepare auth schema", "error", err)
		os.Exit(1)
	}
	if err := authService.EnsureBootstrap(ctx, cfg.SuperAdminEmail, cfg.SuperAdminPassword); err != nil {
		logger.Error("prepare super admin", "error", err)
		os.Exit(1)
	}
	integrationService, err := integrations.NewService(clients.DB, cfg.IntegrationsEncryptionKey)
	if err != nil {
		logger.Error("configure integrations", "error", err)
		os.Exit(1)
	}
	if err := integrationService.EnsureSchema(ctx); err != nil {
		logger.Error("prepare integrations schema", "error", err)
		os.Exit(1)
	}
	managedCredentials, err := integrations.LoadManagedCredentials(cfg.IntegrationCredentialsFile)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		logger.Warn("load managed integration credentials", "error", err)
	}
	if managedCredentials.BattleMetricsToken == "" {
		managedCredentials.BattleMetricsToken = cfg.BattleMetricsAPIToken
	}
	if managedCredentials.SteamWebAPIKey == "" {
		managedCredentials.SteamWebAPIKey = cfg.SteamWebAPIKey
	}
	if managedCredentials.VAPIDPublicKey != "" {
		cfg.VAPIDPublicKey = managedCredentials.VAPIDPublicKey
	}
	if managedCredentials.VAPIDPrivateKey != "" {
		cfg.VAPIDPrivateKey = managedCredentials.VAPIDPrivateKey
	}
	if managedCredentials.VAPIDSubject != "" {
		cfg.VAPIDSubject = managedCredentials.VAPIDSubject
	}
	if err := integrationService.EnsureConfigured(ctx, managedCredentials); err != nil {
		logger.Warn("sync managed integration credentials", "error", err)
	}

	hub := realtime.NewHub()
	go hub.Run(ctx)
	pushService := push.NewService(clients.DB, push.Config{
		PublicKey: cfg.VAPIDPublicKey, PrivateKey: cfg.VAPIDPrivateKey, Subject: cfg.VAPIDSubject,
	})
	if err := pushService.EnsureSchema(ctx); err != nil {
		logger.Error("prepare push schema", "error", err)
		os.Exit(1)
	}
	checker := servercheck.NewService(clients.DB, hub, pushService)
	if err := checker.EnsureSchema(ctx); err != nil {
		logger.Error("prepare server checker schema", "error", err)
		os.Exit(1)
	}
	players := playerstore.NewService(clients.DB, hub, pushService)
	if err := players.EnsureSchema(ctx); err != nil {
		logger.Error("prepare saved players schema", "error", err)
		os.Exit(1)
	}
	go refreshWatchlist(ctx, checker, logger)
	go refreshSavedPlayers(ctx, players, integrationService, logger)

	server := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           httpapi.NewRouter(cfg, clients, hub, logger, integrationService),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("api listening", "addr", cfg.ListenAddr, "environment", cfg.Environment)
		serverErr <- server.ListenAndServe()
	}()

	select {
	case err := <-serverErr:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("api server stopped", "error", err)
			os.Exit(1)
		}
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Error("shutdown api server", "error", err)
			os.Exit(1)
		}
		logger.Info("api stopped")
	}
}

func refreshWatchlist(ctx context.Context, checker *servercheck.Service, logger *slog.Logger) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			refreshCtx, cancel := context.WithTimeout(ctx, 55*time.Second)
			if err := checker.RefreshAll(refreshCtx); err != nil {
				logger.Warn("refresh server watchlist", "error", err)
			}
			cancel()
		}
	}
}

func refreshSavedPlayers(ctx context.Context, players *playerstore.Service, integrationService *integrations.Service, logger *slog.Logger) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			refreshCtx, cancel := context.WithTimeout(ctx, 55*time.Second)
			if err := players.RefreshAll(refreshCtx, integrationService); err != nil {
				logger.Warn("refresh saved players", "error", err)
			}
			cancel()
		}
	}
}
