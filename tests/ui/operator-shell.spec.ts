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
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Readiness" })).toBeVisible();

  await page.getByTestId("server-rcon-test").click();
  await expect(page.getByText("RCON test: ok")).toBeVisible();
  await page.getByText("RCON test details").click();
  await expect(page.getByText("WebRCON serverinfo responded.")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});
