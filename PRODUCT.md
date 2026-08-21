# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are ordinary Rust players. They use the product to find public Rust servers, inspect public Steam profiles, and keep their own Rust+ servers and in-game context together. Workspace administrators can create people and grant access, but are not assumed to own or administer Rust game servers.

## Product Purpose

RustControl is a player companion, not a server control panel. It brings public server discovery and player-owned Rust+ data into one secure workspace, starting with a small set of dependable flows.

## Positioning

The product only accesses the information and controls that a player has personally paired in Rust+. It never needs RCON, server files, or server-owner permissions.

## Operating Context

Users run the web app locally through Docker during development and will pair a Rust+ enabled server while signed into their own Steam account and connected to that server in Rust.

## Capabilities and Constraints

- Go owns domain state, authentication, external connections, encryption, and realtime delivery; Next.js owns the interface; PostgreSQL is the source of truth.
- Steam Web API credentials are server-managed and never entered into the browser.
- Rust+ bindings are account-scoped, encrypted at rest, and must be removable by their owner.
- No player-facing credential settings, no RCON, no server administration, and no fabricated live data or inactive controls.
- Rust+ interoperability is isolated behind a bridge because its external companion protocol can change independently of this product.

## Brand Commitments

The product name is RustControl. Preserve the existing dark, compact player-companion shell and the user-provided AdminCN-inspired navigation convention; profile actions remain in the top-right account menu rather than the sidebar.

## Evidence on Hand

- Public server discovery uses BattleMetrics when configured.
- Public Steam profile lookup is connected through a server-managed Steam Web API key.
- Official Facepunch material confirms Rust+ player functions including paired server data, map, team, chat, and devices.
- No server-admin access, RCON endpoint, plugin data, or production Rust+ test binding is available yet.

## Product Principles

1. Every player-visible action must do real work or be absent.
2. Keep secrets and pairing credentials off the browser surface and out of Git.
3. Start with player-owned data and expand only after a reliable live connection exists.
4. Make data source and access limits clear without exposing implementation detail.
