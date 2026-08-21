package realtime

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4 * 1024
)

type Event struct {
	Type      string         `json:"type"`
	Timestamp time.Time      `json:"timestamp"`
	Payload   map[string]any `json:"payload,omitempty"`
}

type Hub struct {
	clients    map[*client]struct{}
	unregister chan *client
	broadcast  chan []byte
	mu         sync.RWMutex
	connected  atomic.Int64
}

type client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userID int64
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*client]struct{}),
		unregister: make(chan *client),
		broadcast:  make(chan []byte, 64),
	}
}

func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case c := <-h.unregister:
			h.remove(c)
		case message := <-h.broadcast:
			h.mu.RLock()
			clients := make([]*client, 0, len(h.clients))
			for c := range h.clients {
				clients = append(clients, c)
			}
			h.mu.RUnlock()
			for _, c := range clients {
				select {
				case c.send <- message:
				default:
					h.remove(c)
				}
			}
		}
	}
}

func (h *Hub) remove(c *client) {
	h.mu.Lock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		close(c.send)
		h.connected.Add(-1)
	}
	h.mu.Unlock()
	_ = c.conn.Close()
}

func (h *Hub) add(c *client) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
	h.connected.Add(1)
}

func (h *Hub) Publish(event Event) {
	message, err := json.Marshal(event)
	if err != nil {
		return
	}
	select {
	case h.broadcast <- message:
	default:
	}
}

func (h *Hub) PublishToUser(userID int64, event Event) {
	message, err := json.Marshal(event)
	if err != nil {
		return
	}
	h.mu.RLock()
	clients := make([]*client, 0)
	for c := range h.clients {
		if c.userID == userID {
			clients = append(clients, c)
		}
	}
	h.mu.RUnlock()
	for _, c := range clients {
		select {
		case c.send <- message:
		default:
			h.remove(c)
		}
	}
}

func (h *Hub) Stats() map[string]int64 {
	return map[string]int64{"connections": h.connected.Load()}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request, logger *slog.Logger, upgrader websocket.Upgrader, userID int64) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Warn("websocket upgrade failed", "error", err)
		return
	}

	c := &client{hub: h, conn: conn, send: make(chan []byte, 16), userID: userID}
	h.add(c)
	h.PublishToUser(userID, Event{Type: "realtime.connected", Timestamp: time.Now().UTC(), Payload: map[string]any{"channel": "control"}})

	go c.writePump()
	c.readPump()
}

func (c *client) readPump() {
	defer func() { c.hub.unregister <- c }()
	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})
	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			break
		}
	}
}

func (c *client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
