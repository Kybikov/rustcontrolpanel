package servercheck

import (
	"context"
	"encoding/binary"
	"errors"
	"testing"
)

func TestParseEndpointAllowsPublicIPv4AndRejectsPrivateNetworks(t *testing.T) {
	endpoint, err := parseEndpoint(context.Background(), "79.137.98.23:28015")
	if err != nil || endpoint.ip.String() != "79.137.98.23" || endpoint.port != 28015 {
		t.Fatalf("parse public endpoint = %+v, %v", endpoint, err)
	}
	if _, err := parseEndpoint(context.Background(), "127.0.0.1:28015"); !errors.Is(err, ErrInvalidAddress) {
		t.Fatalf("private endpoint error = %v, want ErrInvalidAddress", err)
	}
}

func TestParseInfoPacketKeepsExtendedRustDetails(t *testing.T) {
	packet := []byte{0xff, 0xff, 0xff, 0xff, 0x49, 17}
	for _, value := range []string{"Example Rust", "Procedural Map", "rust", "Rust"} {
		packet = append(packet, []byte(value)...)
		packet = append(packet, 0)
	}
	packet = appendUint16(packet, 0)
	packet = append(packet, 42, 200, 0, 'd', 'l', 0, 1)
	packet = append(packet, []byte("2632")...)
	packet = append(packet, 0, 0x91)
	packet = appendUint16(packet, 28015)
	packet = appendUint64(packet, 90291277432678429)
	packet = appendUint64(packet, rustAppID)

	info, err := parseInfoPacket(packet)
	if err != nil {
		t.Fatalf("parseInfoPacket() error = %v", err)
	}
	if info.Protocol != 17 || info.ServerKind != "dedicated" || info.Environment != "linux" {
		t.Fatalf("unexpected technical details: %+v", info)
	}
	if info.AdvertisedPort != 28015 || info.ServerSteamID != 90291277432678429 || info.GameID != rustAppID {
		t.Fatalf("unexpected extended fields: %+v", info)
	}
}

func TestQueryErrorRetainsBlockedStatus(t *testing.T) {
	if !errors.Is(queryError(ErrPublicQueryBlocked), ErrPublicQueryBlocked) {
		t.Fatal("blocked A2S response must remain distinguishable")
	}
}

func appendUint16(packet []byte, value uint16) []byte {
	buffer := make([]byte, 2)
	binary.LittleEndian.PutUint16(buffer, value)
	return append(packet, buffer...)
}

func appendUint64(packet []byte, value uint64) []byte {
	buffer := make([]byte, 8)
	binary.LittleEndian.PutUint64(buffer, value)
	return append(packet, buffer...)
}
