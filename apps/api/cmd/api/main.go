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

	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/config"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/httpapi"
	"github.com/Kybikov/rustcontrolpanel/apps/api/internal/realtime"
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

	hub := realtime.NewHub()
	go hub.Run(ctx)

	server := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           httpapi.NewRouter(cfg, clients, hub, logger),
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
