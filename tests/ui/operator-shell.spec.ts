import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.UI_SMOKE_API_BASE_URL ?? "http://127.0.0.1:18080";

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function smokeToken() {
  const now = Math.floor(Date.now() / 1000);
  return [
    base64Url(JSON.stringify({ alg: "none", typ: "JWT" })),
    base64Url(JSON.stringify({
      email: "smoke.operator@example.invalid",
      exp: now + 3600,
      iat: now,
      name: "Smoke Operator",
      sub: "00000000-0000-0000-0000-000000000001",
    })),
    "smoke",
  ].join(".");
}

test.beforeEach(async ({ page }) => {
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/me/live-context`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          connected: true,
          source_status: "ok",
          steam: {
            persona_name: "Smoke Operator",
            steam_id: "76561197960287930",
          },
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/search**`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [],
          source_status: "empty",
        },
      }),
    });
  });
  await page.addInitScript(({ token, baseUrl }) => {
    window.localStorage.setItem("rustcp.accessToken", token);
    window.localStorage.setItem("rustcp.baseUrl", baseUrl);
  }, { token: smokeToken(), baseUrl: apiBaseUrl });
});

test("operator shell command search and raid planner work in production build", async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.goto("/tools?tab=raid");

  await expect(page).toHaveTitle(/Rust Control Panel/);
  await expect(page.getByText("Rust Control", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tools" })).toBeVisible();
  await expect(page.getByText("Raid Budget Planner")).toBeVisible();

  await page.getByTestId("command-search-open").click();
  await page.getByTestId("command-search-input").fill("field");
  await expect(page.getByTestId("command-search-result").filter({ hasText: "Field Guides" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("command-search-input")).toBeHidden();

  await page.getByTestId("raid-target-select").selectOption("metal_wall");
  await page.getByTestId("raid-quantity-input").fill("2");
  await page.getByTestId("raid-reserve-input").fill("0");

  const summary = page.getByTestId("raid-summary");
  await expect(summary).toContainText("Selected method");
  await expect(summary).toContainText("C4");
  await expect(summary).toContainText("Total sulfur");
  await expect(summary).toContainText("17,600");

  expect(consoleProblems).toEqual([]);
});

test("saved server filters persist and apply query presets", async ({ page }) => {
  const consoleProblems: string[] = [];
  const serverRequests: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/servers**`, async (route) => {
    const url = new URL(route.request().url());
    serverRequests.push(url.toString());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [],
          source_status: "ok",
        },
        meta: { total: 0, page: Number(url.searchParams.get("page") ?? "1"), per_page: 25, count: 0 },
      }),
    });
  });

  await page.goto("/servers");
  await expect(page.getByRole("heading", { name: "Servers", exact: true })).toBeVisible();

  const trackedSearch = page.getByPlaceholder("Filter tracked servers");
  const statusSelect = page.locator("select").first();
  await trackedSearch.fill("eu trio");
  await statusSelect.selectOption("online");
  await page.getByTestId("servers-saved-filters").locator("summary").click();
  await page.getByTestId("servers-saved-filters-name").fill("Online EU");
  await page.getByTestId("servers-saved-filters-save").click();
  await expect(page.getByTestId("servers-saved-filters-preset").filter({ hasText: "Online EU" })).toBeVisible();

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(trackedSearch).toHaveValue("");
  await expect(statusSelect).toHaveValue("all");

  await page.getByTestId("servers-saved-filters-preset").filter({ hasText: "Online EU" }).click();
  await expect(trackedSearch).toHaveValue("eu trio");
  await expect(statusSelect).toHaveValue("online");
  await expect
    .poll(() => serverRequests.some((url) => url.includes("tracked_q=eu+trio") && url.includes("status=online")))
    .toBe(true);

  expect(consoleProblems).toEqual([]);
});

test("activity time range sends backend filters", async ({ page }) => {
  const consoleProblems: string[] = [];
  const activityRequests: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/activity**`, async (route) => {
    const url = new URL(route.request().url());
    activityRequests.push(url.toString());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [],
          stats: { total: 0, warning: 0, error: 0, operator_notes: 0 },
          sources: [],
          event_types: [],
          source_status: "empty",
        },
        meta: { total: 0, page: Number(url.searchParams.get("page") ?? "1"), per_page: 50, count: 0 },
      }),
    });
  });

  await page.goto("/activity");
  await expect(page.getByRole("heading", { name: "Realtime Activity" })).toBeVisible();
  await page.getByTestId("activity-time-range").locator("summary").click();
  await page.getByTestId("activity-from-filter").fill("2026-07-03T10:00");
  await page.getByTestId("activity-to-filter").fill("2026-07-03T12:30");

  await expect
    .poll(() =>
      activityRequests.some((requestUrl) => {
        const params = new URL(requestUrl).searchParams;
        return params.get("from")?.startsWith("2026-07-03T") && params.get("to")?.startsWith("2026-07-03T");
      }),
    )
    .toBe(true);

  expect(consoleProblems).toEqual([]);
});

test("server settings expose read-only rcon readiness test", async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/servers/smoke-server`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          server: {
            id: "smoke-server",
            name: "Smoke Rust Server",
            battlemetrics_server_id: "12345678",
            ip: "127.0.0.1",
            port: 28015,
            players: 4,
            max_players: 100,
            status: "online",
          },
          snapshots: [],
          wipes: [],
          activity: [],
          settings: {
            battlemetrics_server_id: "12345678",
            plugin_webhook_ready: true,
            rcon_configured: true,
            rcon_actions_enabled: false,
            rcon_read_only: true,
            rcon_status: "configured",
          },
          source_status: "ok",
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/servers/smoke-server/live-context`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          server: {
            id: "smoke-server",
            name: "Smoke Rust Server",
            battlemetrics_server_id: "12345678",
            status: "online",
          },
          live_players: [],
          activity: [],
          counts: { online_players: 0 },
          source_status: "ok",
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/servers/smoke-server/snapshots**`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            { id: "snap-3", players: 12, max_players: 100, rank: 210, status: "online", captured_at: "2026-07-03T12:10:00Z" },
            { id: "snap-2", players: 7, max_players: 100, rank: 260, status: "online", captured_at: "2026-07-03T12:05:00Z" },
            { id: "snap-1", players: 4, max_players: 100, rank: 320, status: "online", captured_at: "2026-07-03T12:00:00Z" },
          ],
          source_status: "ok",
        },
        meta: { total: 3, page: 1, per_page: 96, count: 3 },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/servers/smoke-server/map`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          server: {
            id: "smoke-server",
            name: "Smoke Rust Server",
            battlemetrics_server_id: "12345678",
            rust_world_size: 4250,
          },
          map: {},
          markers: [],
          event_markers: [],
          live_players: [],
          source_status: "ok",
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/servers/smoke-server/position-snapshots**`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              observed_at: "2026-07-03T12:10:15Z",
              live_player: {
                id: "pos-1",
                server_id: "smoke-server",
                battlemetrics_server_id: "12345678",
                display_name: "Replay Known",
                steam_id: "76561198000000001",
                is_online: true,
                position: { x: 1100, y: 32, z: 900 },
                map_grid: "G12",
                health: 91,
                source: "plugin",
                last_seen_at: "2026-07-03T12:10:15Z",
              },
              player: {
                id: "player-replay-known",
                display_name: "Replay Known",
                steam_id: "76561198000000001",
              },
            },
            {
              observed_at: "2026-07-03T12:10:45Z",
              live_player: {
                id: "pos-2",
                server_id: "smoke-server",
                battlemetrics_server_id: "12345678",
                display_name: "Replay Unknown",
                is_online: true,
                position: { x: 1400, y: 30, z: 1250 },
                map_grid: "H13",
                health: 77,
                source: "plugin",
                last_seen_at: "2026-07-03T12:10:45Z",
              },
            },
          ],
          source_status: "ok",
        },
        meta: { total: 2, page: 1, per_page: 160, count: 2 },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/integrations/rcon/test`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          provider: "rcon",
          status: "ok",
          enabled: true,
          checked_at: new Date().toISOString(),
          checks: [
            { name: "enabled", status: "ok", message: "RCON integration is enabled in workspace settings." },
            { name: "websocket_serverinfo", status: "ok", message: "WebRCON serverinfo responded.", command: "serverinfo", players: 4, max_players: 100 },
          ],
          sync_run_id: "sync-smoke-rcon",
        },
      }),
    });
  });

  await page.goto("/servers/smoke-server");
  await expect(page.getByRole("heading", { name: "Server Detail" })).toBeVisible();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByTestId("server-history-chart")).toBeVisible();
  await expect(page.getByText("12 / 100")).toBeVisible();
  await expect(page.getByText("rank 210")).toBeVisible();
  await page.getByRole("button", { name: "Map" }).click();
  await page.getByTestId("server-position-replay").locator("summary").click();
  await expect(page.getByTestId("server-position-replay-slider")).toBeVisible();
  await expect(page.getByText("2 samples")).toBeVisible();
  await expect(page.getByText("Replay Known").first()).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Readiness" })).toBeVisible();

  await page.getByTestId("server-rcon-test").click();
  await expect(page.getByText("RCON test: ok")).toBeVisible();
  await page.getByText("RCON test details").click();
  await expect(page.getByText("WebRCON serverinfo responded.")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test("operator profile history pages watch changes and alerts", async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/overview`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          tracked_servers: 2,
          known_players: 18,
          team_edges: 4,
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/realtime/health`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          status: "ok",
          counts: { live_online: 3 },
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/integrations`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          providers: [],
          recent_sync_runs: [],
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/activity**`, async (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page") ?? "1");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              id: `activity-${pageNumber}`,
              occurred_at: "2026-07-03T12:00:00Z",
              severity: "info",
              source: "admin",
              event_type: `profile_activity_page_${pageNumber}`,
              payload: { message: "profile smoke" },
            },
          ],
          source_status: "ok",
          stats: { total: 40, warning: 0, error: 0, operator_notes: 1 },
        },
        meta: { total: 40, page: pageNumber, per_page: 25, count: 1 },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/watchlist**`, async (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page") ?? "1");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              watch: {
                id: `watch-${pageNumber}`,
                player_id: `player-${pageNumber}`,
                watched: true,
                risk_level: pageNumber === 1 ? "hostile" : "suspect",
                reason: `watch page ${pageNumber}`,
                updated_at: "2026-07-03T12:00:00Z",
              },
              player: {
                id: `player-${pageNumber}`,
                display_name: `Watched Player ${pageNumber}`,
                steam_id: `7656119796028793${pageNumber}`,
              },
            },
          ],
          stats: { total: 10, hostile: 1, suspect: 1, online: 1 },
          source_status: "ok",
        },
        meta: { total: 10, page: pageNumber, per_page: 8, count: 1 },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/alerts**`, async (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page") ?? "1");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              alert_type: `same_server_page_${pageNumber}`,
              severity: pageNumber === 1 ? "critical" : "warning",
              player: {
                id: `alert-player-${pageNumber}`,
                display_name: `Alert Player ${pageNumber}`,
              },
              watch: {
                id: `alert-watch-${pageNumber}`,
                player_id: `alert-player-${pageNumber}`,
                watched: true,
                risk_level: "hostile",
              },
              current_server: {
                name: `Alert Server ${pageNumber}`,
              },
            },
          ],
          source_status: "ok",
        },
        meta: { total: 12, page: pageNumber, per_page: 6, count: 1 },
      }),
    });
  });

  await page.goto("/profile/history");
  await expect(page.getByRole("heading", { name: "Operator Profile" })).toBeVisible();
  await expect(page.getByText("Recent Account Feed")).toBeVisible();
  await expect(page.getByTestId("profile-activity-pager")).toContainText("40 profile events / page 1 of 2");
  await expect(page.getByTestId("profile-watchlist-pager")).toContainText("10 watch changes / page 1 of 2");
  await expect(page.getByTestId("profile-alerts-pager")).toContainText("12 active alerts / page 1 of 2");

  await page.getByTestId("profile-watchlist-pager-next").click();
  await expect(page.getByText("Watched Player 2")).toBeVisible();
  await expect(page.getByTestId("profile-watchlist-pager")).toContainText("page 2 of 2");

  await page.getByTestId("profile-alerts-pager-next").click();
  await expect(page.getByText("Alert Player 2")).toBeVisible();
  await expect(page.getByTestId("profile-alerts-pager")).toContainText("page 2 of 2");

  expect(consoleProblems).toEqual([]);
});
