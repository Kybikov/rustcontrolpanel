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
          items: [
            {
              id: "activity-entity-smoke",
              event_type: "rcon_admin_action",
              severity: "warning",
              source: "rcon",
              payload: { action: "kick", reason: "smoke" },
              occurred_at: "2026-07-03T10:05:00Z",
              server_id: "11111111-1111-1111-1111-111111111111",
              server: {
                id: "11111111-1111-1111-1111-111111111111",
                name: "Smoke Server",
                battlemetrics_server_id: "1234567",
              },
              player_id: "22222222-2222-2222-2222-222222222222",
              player: {
                id: "22222222-2222-2222-2222-222222222222",
                display_name: "Smoke Target",
                steam_id: "76561197960287930",
              },
            },
          ],
          stats: { total: 1, warning: 1, error: 0, operator_notes: 0 },
          sources: [],
          event_types: [],
          source_status: "ok",
        },
        meta: { total: 1, page: Number(url.searchParams.get("page") ?? "1"), per_page: 50, count: 1 },
      }),
    });
  });

  await page.goto("/activity");
  await expect(page.getByRole("heading", { name: "Realtime Activity" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Smoke Target/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Smoke Server/ })).toBeVisible();
  await page.getByTestId("activity-time-range").locator("summary").click();
  await page.getByTestId("activity-from-filter").fill("2026-07-03T10:00");
  await page.getByTestId("activity-to-filter").fill("2026-07-03T12:30");
  await page.getByTestId("activity-entity-filters").locator("summary").click();
  await page.getByTestId("activity-server-id-filter").fill("11111111-1111-1111-1111-111111111111");
  await page.getByTestId("activity-player-id-filter").fill("22222222-2222-2222-2222-222222222222");

  await expect
    .poll(() =>
      activityRequests.some((requestUrl) => {
        const params = new URL(requestUrl).searchParams;
        return (
          params.get("from")?.startsWith("2026-07-03T") &&
          params.get("to")?.startsWith("2026-07-03T") &&
          params.get("server_id") === "11111111-1111-1111-1111-111111111111" &&
          params.get("player_id") === "22222222-2222-2222-2222-222222222222"
        );
      }),
    )
    .toBe(true);

  expect(consoleProblems).toEqual([]);
});

test("wipe calendar switches day week month and records windows", async ({ page }) => {
  const consoleProblems: string[] = [];
  const wipeRequests: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/servers**`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              id: "server-wipe-smoke",
              name: "Smoke Wipe Server",
              battlemetrics_server_id: "98765432",
              status: "online",
            },
          ],
          source_status: "ok",
        },
        meta: { total: 1, page: 1, per_page: 100, count: 1 },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/wipes**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/wipes/reminders")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: { items: [], source_status: "empty" },
          meta: { total: 0, page: 1, per_page: 20, count: 0 },
        }),
      });
      return;
    }

    wipeRequests.push(url.toString());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              id: `wipe-${url.searchParams.get("window") ?? "default"}`,
              server_id: "server-wipe-smoke",
              server_name: "Smoke Wipe Server",
              wipe_type: "map_wipe",
              wipe_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              source: "battlemetrics",
              confidence: 82,
              created_at: "2026-07-03T10:00:00Z",
            },
          ],
          source_status: "ok",
        },
        meta: { total: 1, page: Number(url.searchParams.get("page") ?? "1"), per_page: 50, count: 1 },
      }),
    });
  });

  await page.goto("/wipes");
  await expect(page.getByRole("heading", { name: "Wipe Calendar" })).toBeVisible();
  await expect(page.getByText("Next 7 Days")).toBeVisible();
  await expect(page.getByText("battlemetrics / confidence 82")).toBeVisible();

  await page.getByRole("button", { name: "Day", exact: true }).click();
  await expect(page.getByText("Today")).toBeVisible();
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.getByText("Next 30 Days")).toBeVisible();
  await page.getByRole("button", { name: "Records", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Wipe Records" })).toBeVisible();

  await expect
    .poll(() => wipeRequests.map((requestUrl) => new URL(requestUrl).searchParams.get("window")))
    .toEqual(expect.arrayContaining(["week", "day", "month", "all"]));

  expect(consoleProblems).toEqual([]);
});

test("battlemetrics integration saves tracked sync interval from compact controls", async ({ page }) => {
  const consoleProblems: string[] = [];
  let savedPayload: Record<string, any> | undefined;
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  const provider = {
    provider: "battlemetrics",
    label: "BattleMetrics",
    configured: true,
    enabled: true,
    public_mode: true,
    testable: true,
    status: "configured",
    use: "Server search, sessions and tracked sync.",
    secret_source: "BATTLEMETRICS_API_TOKEN",
    secret_configured: true,
    secret_storage: "env",
    secret_hint: "env",
    updated_at: "2026-07-03T10:00:00Z",
    config: {
      auto_sync_enabled: true,
      sync_interval_minutes: 5,
      server_page_size: 25,
      player_page_size: 25,
    },
  };

  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/integrations`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          providers: [provider],
          recent_sync_runs: [],
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/integrations/battlemetrics`, async (route) => {
    savedPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          provider: {
            ...provider,
            config: savedPayload?.config ?? provider.config,
          },
          dropped_secret_keys: [],
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/sync-runs**`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: { items: [], source_status: "empty" },
        meta: { total: 0, page: 1, per_page: 12, count: 0 },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/realtime/health`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          status: "ok",
          counts: { live_online: 0, events_5m: 0 },
          integrations: { rust_plus: { configured: false } },
          sources: [],
          recent_events: [],
        },
      }),
    });
  });

  await page.goto("/integrations");
  await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
  await expect(page.getByText("Tracked server sync")).toBeVisible();
  await page.getByTestId("battlemetrics-sync-interval").fill("10");
  await page.getByTestId("integration-save-battlemetrics").click();

  await expect.poll(() => savedPayload?.config?.sync_interval_minutes).toBe(10);
  await expect.poll(() => savedPayload?.config?.auto_sync_enabled).toBe(true);
  expect(consoleProblems).toEqual([]);
});

test("rcon integration saves target guard from compact controls", async ({ page }) => {
  const consoleProblems: string[] = [];
  let savedPayload: Record<string, any> | undefined;
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  const provider = {
    provider: "rcon",
    label: "Server RCON",
    configured: true,
    enabled: true,
    public_mode: false,
    testable: true,
    status: "configured",
    use: "Server owner WebRCON.",
    secret_source: "RUSTCONTROL_RCON_PASSWORD",
    secret_configured: true,
    secret_storage: "stored",
    secret_hint: "main server",
    updated_at: "2026-07-03T10:00:00Z",
    config: {
      host: "127.0.0.1",
      port: 28016,
      tls: false,
      command_timeout_seconds: 10,
      read_only: true,
      allow_actions: false,
      server_id: "",
      battlemetrics_server_id: "",
      tracked_server_id: "legacy-server",
      server_key: "legacy-bm",
    },
  };

  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/integrations`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          providers: [provider],
          recent_sync_runs: [],
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/integrations/rcon`, async (route) => {
    savedPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          provider: {
            ...provider,
            config: savedPayload?.config ?? provider.config,
          },
          dropped_secret_keys: [],
        },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/sync-runs**`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: { items: [], source_status: "empty" },
        meta: { total: 0, page: 1, per_page: 12, count: 0 },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/realtime/health`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          status: "ok",
          counts: { live_online: 0, events_5m: 0 },
          integrations: { rcon: { configured: true } },
          sources: [],
          recent_events: [],
        },
      }),
    });
  });

  await page.goto("/integrations");
  await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
  await expect(page.getByText("RCON target guard")).toBeVisible();
  await page.getByTestId("rcon-host-input").fill("10.10.0.5");
  await page.getByTestId("rcon-port-input").fill("28018");
  await page.getByTestId("rcon-server-id-input").fill("11111111-1111-1111-1111-111111111111");
  await page.getByTestId("rcon-battlemetrics-id-input").fill("12345678");
  await page.getByTestId("integration-save-rcon").click();

  await expect.poll(() => savedPayload?.config?.host).toBe("10.10.0.5");
  await expect.poll(() => savedPayload?.config?.port).toBe(28018);
  await expect.poll(() => savedPayload?.config?.server_id).toBe("11111111-1111-1111-1111-111111111111");
  await expect.poll(() => savedPayload?.config?.battlemetrics_server_id).toBe("12345678");
  expect(savedPayload?.config).not.toHaveProperty("tracked_server_id");
  expect(savedPayload?.config).not.toHaveProperty("server_key");
  expect(consoleProblems).toEqual([]);
});

test("player detail sends managed rcon action for current server", async ({ page }) => {
  const consoleProblems: string[] = [];
  let rconPath = "";
  let rconPayload: { action?: string; target?: string; reason?: string } | undefined;
  const positionTrailRequests: string[] = [];
  const timelineRequests: string[] = [];
  const steamId = "76561198000000003";
  const player = {
    id: "player-managed",
    display_name: "Managed Target",
    steam_id: steamId,
    battlemetrics_player_id: "bm-managed",
    avatar_url: "",
  };
  const currentServer = {
    id: "server-managed",
    name: "Managed Smoke Server",
    battlemetrics_server_id: "98765433",
    ip: "127.0.0.1",
    port: 28015,
    players: 12,
    max_players: 100,
    rank: 120,
    status: "online",
    rust_world_size: 4250,
    rust_world_seed: 12345,
    next_wipe_at: "2026-07-04T12:00:00Z",
  };

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/players**`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const detailEnvelope = (data: Record<string, unknown>) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data }),
      });

    if (path.endsWith("/intel")) {
      await detailEnvelope({
        player,
        watch: null,
        live_player: {
          id: "live-managed",
          server_id: currentServer.id,
          server_name: currentServer.name,
          battlemetrics_server_id: currentServer.battlemetrics_server_id,
          display_name: player.display_name,
          steam_id: steamId,
          is_online: true,
          position: { x: 1200, y: 35, z: 980 },
          map_grid: "G12",
          source: "plugin",
          last_seen_at: "2026-07-03T12:00:00Z",
        },
        live_status: { status: "ok", is_online: true, server_id: currentServer.id, last_seen_at: "2026-07-03T12:00:00Z", source: "plugin" },
        current_server: currentServer,
        realtime_teammates: [],
        realtime_context: { counts: {}, source_status: "ok" },
        nearby_players: [],
        likely_teammates: [],
        team_evidence: [],
        recent_sessions: [],
        recent_activity: [],
        source_status: "ok",
      });
      return;
    }
    if (path.endsWith("/sessions")) {
      await detailEnvelope({ items: [], source_status: "ok", stored_sessions: 0, overlap_edges_updated: 0 });
      return;
    }
    if (path.endsWith("/dossier")) {
      await detailEnvelope({ player, summary: {}, top_servers: [], active_hours: [], activity_types: [], evidence_types: [], relation_sources: [], source_status: "ok" });
      return;
    }
    if (path.endsWith("/relations")) {
      await detailEnvelope({ target: { player }, items: [], counts: {}, source_status: "ok" });
      return;
    }
    if (path.endsWith("/network")) {
      await detailEnvelope({ target: { player }, nodes: [], counts: { nodes: 0 }, source_status: "ok" });
      return;
    }
    if (path.endsWith("/server-history")) {
      await detailEnvelope({ player, current_server: currentServer, top_servers: [], recent_sessions: [], repeated_companions: [], evidence_servers: [], counts: {}, source_status: "ok" });
      return;
    }
    if (path.endsWith("/position-trail")) {
      const pageNumber = Number(url.searchParams.get("page") ?? "1");
      const perPage = Number(url.searchParams.get("per_page") ?? "40");
      positionTrailRequests.push(url.search);
      const allSamples = Array.from({ length: 45 }, (_, index) => ({
        id: `position-${index + 1}`,
        display_name: player.display_name,
        steam_id: steamId,
        server_id: currentServer.id,
        server_name: currentServer.name,
        battlemetrics_server_id: currentServer.battlemetrics_server_id,
        position: { x: 1000 + index * 5, y: 35, z: 900 + index * 4 },
        map_grid: `PX${index + 1}`,
        health: 100 - (index % 20),
        source: "plugin",
        observed_at: `2026-07-03T11:${String(Math.max(0, 59 - index)).padStart(2, "0")}:00Z`,
      }));
      const start = (pageNumber - 1) * perPage;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            target: { player },
            items: allSamples.slice(start, start + perPage),
            heat_cells: [
              {
                server: currentServer,
                map_grid: "PX1",
                sample_count: allSamples.length,
                avg_position: { x: 1100, y: 35, z: 980 },
                last_observed_at: "2026-07-03T12:00:00Z",
              },
            ],
            counts: { samples: allSamples.length, grids: allSamples.length, servers: 1, heat_cells: 1 },
            source_status: "ok",
          },
          meta: { total: allSamples.length, page: pageNumber, per_page: perPage, count: allSamples.slice(start, start + perPage).length },
        }),
      });
      return;
    }
    if (path.endsWith("/timeline")) {
      const pageNumber = Number(url.searchParams.get("page") ?? "1");
      const perPage = Number(url.searchParams.get("per_page") ?? "50");
      timelineRequests.push(url.search);
      const allEvents = Array.from({ length: 55 }, (_, index) => ({
        id: `timeline-${index + 1}`,
        item_type: "activity",
        title: `Timeline Event ${index + 1}`,
        subtitle: "paged smoke",
        source: "admin",
        severity: "info",
        occurred_at: `2026-07-03T12:${String(Math.max(0, 59 - index)).padStart(2, "0")}:00Z`,
        server: currentServer,
      }));
      const start = (pageNumber - 1) * perPage;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            target: { player },
            items: allEvents.slice(start, start + perPage),
            counts: { total: allEvents.length, activity: allEvents.length, live: 0, session: 0, evidence: 0 },
            source_status: "ok",
          },
          meta: { total: allEvents.length, page: pageNumber, per_page: perPage, count: allEvents.slice(start, start + perPage).length },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              player,
              live_player: {
                id: "live-managed",
                server_id: currentServer.id,
                server_name: currentServer.name,
                display_name: player.display_name,
                steam_id: steamId,
                is_online: true,
                map_grid: "G12",
              },
              current_server: currentServer,
              stats: { sessions: 2, playtime_seconds: 3600, probable_team_count: 0 },
              last_activity_at: "2026-07-03T12:00:00Z",
            },
          ],
          stats: { total: 1, watched: 0, online: 1 },
          source_status: "ok",
        },
        meta: { total: 1, page: 1, per_page: 25, count: 1 },
      }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/servers/server-managed/rcon/actions`, async (route) => {
    rconPath = new URL(route.request().url()).pathname;
    rconPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          status: "sent",
          message: "RCON action sent.",
          activity_id: "activity-rcon-smoke",
          server_id: currentServer.id,
          action: rconPayload?.action,
          target: rconPayload?.target,
          response_preview: "ok",
        },
      }),
    });
  });

  await page.goto("/players");
  await expect(page.getByRole("heading", { name: "Player Intelligence" })).toBeVisible();
  await page.getByRole("button", { name: "Intel" }).click();
  await expect(page.getByText("Managed Target").first()).toBeVisible();
  await page.getByTestId("player-managed-actions").locator("summary").click();
  await expect(page.getByText("Managed Smoke Server").first()).toBeVisible();
  await page.getByTestId("player-rcon-reason").fill("Smoke mute from player detail");
  await page.getByTestId("player-rcon-send").click();

  await expect.poll(() => rconPath).toContain("/api/admin/rustcontrol/servers/server-managed/rcon/actions");
  await expect.poll(() => rconPayload?.action).toBe("mute");
  await expect.poll(() => rconPayload?.target).toBe(steamId);
  await expect.poll(() => rconPayload?.reason).toBe("Smoke mute from player detail");
  await expect(page.getByText("mute 76561198000000003")).toBeVisible();
  await page.locator("main").getByRole("button", { name: "Live", exact: true }).click();
  await expect(page.getByTestId("player-position-trail-page")).toContainText("45 position samples / page 1 of 2");
  await expect(page.getByText("PX1", { exact: true }).first()).toBeVisible();
  await page.getByTestId("player-position-trail-page-next").click();
  await expect.poll(() => positionTrailRequests.some((search) => search.includes("page=2") && search.includes("per_page=40"))).toBeTruthy();
  await expect(page.getByTestId("player-position-trail-page")).toContainText("45 position samples / page 2 of 2");
  await expect(page.getByText("PX41", { exact: true })).toBeVisible();
  expect(positionTrailRequests.some((search) => search.includes("page=1") && search.includes("per_page=40"))).toBeTruthy();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByTestId("player-timeline-page")).toContainText("55 timeline events / page 1 of 2");
  await expect(page.getByText("Timeline Event 1", { exact: true })).toBeVisible();
  await page.getByTestId("player-timeline-page-next").click();
  await expect.poll(() => timelineRequests.some((search) => search.includes("page=2") && search.includes("per_page=50"))).toBeTruthy();
  await expect(page.getByTestId("player-timeline-page")).toContainText("55 timeline events / page 2 of 2");
  await expect(page.getByText("Timeline Event 51", { exact: true })).toBeVisible();
  expect(timelineRequests.some((search) => search.includes("page=1") && search.includes("per_page=50"))).toBeTruthy();
  expect(consoleProblems).toEqual([]);
});

test("known players table shows cached steam ban summary", async ({ page }) => {
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/players**`, async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              player: {
                id: "player-bans",
                display_name: "Ban Checked",
                steam_id: "76561198000000002",
                avatar_url: "",
              },
              stats: {
                sessions: 4,
                playtime_seconds: 7200,
                probable_team_count: 1,
                bans: {
                  community_banned: false,
                  vac_banned: true,
                  number_of_vac_bans: 1,
                  number_of_game_bans: 0,
                  economy_ban: "none",
                  fetched_at: "2026-07-03T12:00:00Z",
                },
              },
              last_activity_at: "2026-07-03T12:00:00Z",
            },
          ],
          stats: { total: 1, watched: 0, online: 0 },
          source_status: "ok",
        },
        meta: { total: 1, page: Number(url.searchParams.get("page") ?? "1"), per_page: 25, count: 1 },
      }),
    });
  });

  await page.goto("/players");
  await expect(page.getByRole("heading", { name: "Player Intelligence" })).toBeVisible();
  await expect(page.getByText("Ban Checked")).toBeVisible();
  await expect(page.getByText("VAC 1")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test("server settings expose read-only rcon readiness test", async ({ page }) => {
  const consoleProblems: string[] = [];
  const mapRequests: string[] = [];
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
          activity: [
            {
              id: "chat-1",
              occurred_at: "2026-07-03T12:11:00Z",
              severity: "info",
              source: "oxide-plugin",
              event_type: "player_chat",
              payload: {
                message: "raid later?",
                player_name: "Player One",
                steam_id: "76561198000000001",
                team_id: "team-smoke",
                map_grid: "G12",
              },
            },
            {
              id: "command-1",
              occurred_at: "2026-07-03T12:12:00Z",
              severity: "info",
              source: "oxide-plugin",
              event_type: "command_usage",
              payload: {
                command: "oxide.reload RustControlPanel",
                player_name: "Console Operator",
              },
            },
            {
              id: "admin-1",
              occurred_at: "2026-07-03T12:13:00Z",
              severity: "warning",
              source: "rcon",
              event_type: "rcon_admin_action",
              payload: {
                action: "ban",
                target: "76561198000000001",
                command: "ban 76561198000000001 smoke",
                reason: "smoke test",
                created_by: "operator-smoke",
              },
            },
          ],
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
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/servers/smoke-server/map**`, async (route) => {
    const url = new URL(route.request().url());
    mapRequests.push(url.search);
    const pageNumber = Number(url.searchParams.get("page") ?? "1");
    const perPage = Number(url.searchParams.get("per_page") ?? "6");
    const allMaps = Array.from({ length: 8 }, (_, index) => ({
      id: `map-${index + 1}`,
      map_name: `Smoke Map ${index + 1}`,
      map_seed: 12340 + index,
      map_size: 4250,
      map_hash: `hash-${index + 1}`,
      map_signature: `seed:${12340 + index}:size:4250`,
      source: "rustmaps",
      fetched_at: `2026-07-0${Math.min(index + 1, 8)}T12:00:00Z`,
    }));
    const start = (pageNumber - 1) * perPage;
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
          map: { stored_map_count: allMaps.length },
          markers: [],
          event_markers: [],
          map_history: allMaps.slice(start, start + perPage),
          map_history_meta: { total: allMaps.length, count: allMaps.slice(start, start + perPage).length, page: pageNumber, per_page: perPage },
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
  await page.getByText("Stored map history").click();
  await expect(page.getByTestId("server-map-history-page")).toBeVisible();
  await expect(page.getByTestId("server-map-history-page")).toContainText("8 stored maps / page 1 of 2");
  await expect(page.getByText("Smoke Map 1")).toBeVisible();
  await page.getByTestId("server-map-history-page-next").click();
  await expect.poll(() => mapRequests.some((search) => search.includes("page=2") && search.includes("per_page=6"))).toBeTruthy();
  await expect(page.getByTestId("server-map-history-page")).toContainText("8 stored maps / page 2 of 2");
  await expect(page.getByText("Smoke Map 7")).toBeVisible();
  expect(mapRequests.some((search) => search.includes("page=1") && search.includes("per_page=6"))).toBeTruthy();
  expect(mapRequests.some((search) => search.includes("page=2") && search.includes("per_page=6"))).toBeTruthy();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Readiness" })).toBeVisible();

  await page.getByTestId("server-rcon-test").click();
  await expect(page.getByText("RCON test: ok")).toBeVisible();
  await page.getByText("RCON test details").click();
  await expect(page.getByText("WebRCON serverinfo responded.")).toBeVisible();
  await page.getByRole("button", { name: "Activity" }).last().click();
  const chatCommandBlock = page.getByTestId("server-chat-command-events");
  await chatCommandBlock.locator("summary").click();
  await expect(chatCommandBlock.getByText("chat 1")).toBeVisible();
  await expect(chatCommandBlock.getByText("commands 1")).toBeVisible();
  await expect(chatCommandBlock.getByText("admin 1")).toBeVisible();
  await expect(chatCommandBlock.getByText("raid later?")).toBeVisible();
  await chatCommandBlock.getByRole("button", { name: "Commands" }).click();
  await expect(chatCommandBlock.getByText("oxide.reload RustControlPanel")).toBeVisible();
  await chatCommandBlock.getByRole("button", { name: "All" }).click();
  await chatCommandBlock.getByTestId("server-chat-command-search").fill("operator-smoke");
  await expect(chatCommandBlock.getByText("ban 76561198000000001 smoke")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test("operator profile history pages watch changes and alerts", async ({ page }) => {
  const consoleProblems: string[] = [];
  const activityRequests: string[] = [];
  const watchlistRequests: string[] = [];
  const alertRequests: string[] = [];
  const disconnectRequests: string[] = [];
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
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/me/steam`, async (route) => {
    if (route.request().method() === "DELETE") {
      disconnectRequests.push(route.request().url());
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            connected: false,
            steam_id: "76561197960287930",
            source_status: "steam_disconnected",
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 405,
      contentType: "application/json",
      body: JSON.stringify({ error: "unexpected method" }),
    });
  });
  await page.route(`${apiBaseUrl}/api/admin/rustcontrol/activity**`, async (route) => {
    const url = new URL(route.request().url());
    activityRequests.push(url.toString());
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
    watchlistRequests.push(url.toString());
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
    alertRequests.push(url.toString());
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
  await expect(page.getByText("My Server Alerts", { exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-activity-pager")).toContainText("40 profile events / page 1 of 2");
  await expect
    .poll(() => activityRequests.some((requestUrl) => new URL(requestUrl).searchParams.get("actor_id") === "00000000-0000-0000-0000-000000000001"))
    .toBe(true);
  await expect
    .poll(() => watchlistRequests.some((requestUrl) => new URL(requestUrl).searchParams.get("actor_id") === "00000000-0000-0000-0000-000000000001"))
    .toBe(true);
  await expect
    .poll(() => alertRequests.some((requestUrl) => new URL(requestUrl).searchParams.get("scope") === "same_server"))
    .toBe(true);
  await expect(page.getByTestId("profile-watchlist-pager")).toContainText("10 watch changes / page 1 of 2");
  await expect(page.getByTestId("profile-alerts-pager")).toContainText("12 my server alerts / page 1 of 2");

  await page.getByTestId("profile-watchlist-pager-next").click();
  await expect(page.getByText("Watched Player 2")).toBeVisible();
  await expect(page.getByTestId("profile-watchlist-pager")).toContainText("page 2 of 2");

  await page.getByTestId("profile-alerts-pager-next").click();
  await expect(page.getByText("Alert Player 2")).toBeVisible();
  await expect(page.getByTestId("profile-alerts-pager")).toContainText("page 2 of 2");

  await page.getByRole("button", { name: "Steam Link" }).click();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByText("Steam disconnected: 76561197960287930")).toBeVisible();
  await expect.poll(() => disconnectRequests.length).toBe(1);

  expect(consoleProblems).toEqual([]);
});
