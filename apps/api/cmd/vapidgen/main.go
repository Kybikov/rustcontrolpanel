package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	webpush "github.com/SherClockHolmes/webpush-go"
)

func main() {
	output := flag.String("out", "", "credentials file to update")
	subject := flag.String("subject", "mailto:rustcontrol@localhost", "VAPID subject")
	flag.Parse()
	if strings.TrimSpace(*output) == "" {
		fmt.Fprintln(os.Stderr, "use -out with the private credentials file")
		os.Exit(2)
	}
	current, err := os.ReadFile(*output)
	if err != nil && !os.IsNotExist(err) {
		fmt.Fprintln(os.Stderr, "read credentials file:", err)
		os.Exit(1)
	}
	normalized := strings.ToLower(string(current))
	if strings.Contains(normalized, "vapid_public_key") || strings.Contains(normalized, "vapid_private_key") {
		fmt.Println("VAPID keys already exist; no changes made.")
		return
	}
	privateKey, publicKey, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		fmt.Fprintln(os.Stderr, "generate VAPID keys:", err)
		os.Exit(1)
	}
	content := strings.TrimRight(string(current), "\r\n")
	if content != "" {
		content += "\n"
	}
	content += fmt.Sprintf("VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\nVAPID_SUBJECT=%s\n", publicKey, privateKey, strings.TrimSpace(*subject))
	if err := os.WriteFile(*output, []byte(content), 0o600); err != nil {
		fmt.Fprintln(os.Stderr, "write credentials file:", err)
		os.Exit(1)
	}
	fmt.Println("VAPID keys created in the private credentials file.")
}
