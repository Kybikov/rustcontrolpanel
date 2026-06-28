using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Oxide.Core.Libraries;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("RustControlPanel", "WaterMelon", "0.1.0")]
    [Description("Streams Rust player, team, combat, and position telemetry into Rust Control Panel.")]
    public class RustControlPanel : RustPlugin
    {
        private PluginConfig _config;
        private Timer _snapshotTimer;

        private class PluginConfig
        {
            [JsonProperty("webhook_url")]
            public string WebhookUrl = "https://your-backend.example.com/webhooks/rustcontrol/00000000-0000-0000-0000-000000000000/events";

            [JsonProperty("webhook_secret")]
            public string WebhookSecret = "";

            [JsonProperty("battlemetrics_server_id")]
            public string BattleMetricsServerId = "";

            [JsonProperty("server_name")]
            public string ServerName = "";

            [JsonProperty("snapshot_interval_seconds")]
            public float SnapshotIntervalSeconds = 10f;

            [JsonProperty("request_timeout_seconds")]
            public float RequestTimeoutSeconds = 10f;

            [JsonProperty("max_players_per_snapshot")]
            public int MaxPlayersPerSnapshot = 250;

            [JsonProperty("grid_cell_size")]
            public float GridCellSize = 150f;

            [JsonProperty("send_position_snapshots")]
            public bool SendPositionSnapshots = true;

            [JsonProperty("send_team_snapshots")]
            public bool SendTeamSnapshots = true;

            [JsonProperty("send_chat_events")]
            public bool SendChatEvents = false;

            [JsonProperty("send_death_events")]
            public bool SendDeathEvents = true;

            [JsonProperty("debug_logging")]
            public bool DebugLogging = false;
        }

        protected override void LoadDefaultConfig()
        {
            _config = new PluginConfig();
            SaveConfig();
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try
            {
                _config = Config.ReadObject<PluginConfig>();
                if (_config == null)
                {
                    throw new Exception("Config is empty");
                }
            }
            catch
            {
                PrintWarning("Invalid config, recreating default RustControlPanel config.");
                LoadDefaultConfig();
            }
        }

        protected override void SaveConfig()
        {
            Config.WriteObject(_config, true);
        }

        private void OnServerInitialized()
        {
            if (!IsConfigured())
            {
                PrintWarning("Webhook is not configured. Set webhook_url and webhook_secret in oxide/config/RustControlPanel.json.");
                return;
            }

            _snapshotTimer?.Destroy();
            _snapshotTimer = timer.Every(Math.Max(5f, _config.SnapshotIntervalSeconds), SendOnlineSnapshot);
            timer.Once(3f, SendOnlineSnapshot);
        }

        private void Unload()
        {
            _snapshotTimer?.Destroy();
        }

        private void OnPlayerConnected(BasePlayer player)
        {
            if (player == null)
            {
                return;
            }
            SendPlayerEvent("player_connected", player, "info", new Dictionary<string, object>
            {
                ["ip"] = player.net?.connection?.ipaddress ?? ""
            });
        }

        private void OnPlayerDisconnected(BasePlayer player, string reason)
        {
            if (player == null)
            {
                return;
            }
            SendPlayerEvent("player_disconnected", player, "info", new Dictionary<string, object>
            {
                ["reason"] = reason ?? ""
            }, false);
        }

        private void OnPlayerDeath(BasePlayer player, HitInfo info)
        {
            if (!_config.SendDeathEvents || player == null)
            {
                return;
            }

            BasePlayer attacker = info?.InitiatorPlayer;
            var related = new List<RelatedPlayer>();
            if (attacker != null && attacker.userID != player.userID)
            {
                related.Add(new RelatedPlayer
                {
                    SteamId = attacker.UserIDString,
                    Name = attacker.displayName,
                    EvidenceType = "combat_interaction",
                    Reason = "killed this player",
                    ScoreDelta = 4
                });
            }

            SendEvent(new EventEnvelope
            {
                EventType = "player_death",
                Severity = "warning",
                Source = "oxide-plugin",
                Server = BuildServer(),
                Player = BuildPlayer(player, false),
                RelatedPlayers = related,
                Payload = new Dictionary<string, object>
                {
                    ["victim_steam_id"] = player.UserIDString,
                    ["victim_name"] = player.displayName,
                    ["attacker_steam_id"] = attacker?.UserIDString ?? "",
                    ["attacker_name"] = attacker?.displayName ?? "",
                    ["damage_type"] = info?.damageTypes?.GetMajorityDamageType().ToString() ?? "",
                    ["weapon"] = info?.WeaponPrefab?.ShortPrefabName ?? ""
                }
            });
        }

        private void OnPlayerChat(BasePlayer player, string message)
        {
            if (!_config.SendChatEvents || player == null)
            {
                return;
            }
            SendPlayerEvent("player_chat", player, "info", new Dictionary<string, object>
            {
                ["message"] = Truncate(message, 500)
            });
        }

        [ConsoleCommand("rustcontrol.snapshot")]
        private void CmdSnapshot(ConsoleSystem.Arg arg)
        {
            SendOnlineSnapshot();
            Puts("RustControlPanel snapshot queued.");
        }

        [ConsoleCommand("rustcontrol.test")]
        private void CmdTest(ConsoleSystem.Arg arg)
        {
            SendEvent(new EventEnvelope
            {
                EventType = "plugin_test",
                Severity = "info",
                Source = "oxide-plugin",
                Server = BuildServer(),
                Payload = new Dictionary<string, object>
                {
                    ["message"] = "RustControlPanel test event",
                    ["online_players"] = BasePlayer.activePlayerList.Count
                }
            });
            Puts("RustControlPanel test event queued.");
        }

        private void SendOnlineSnapshot()
        {
            if (!IsConfigured() || !_config.SendPositionSnapshots)
            {
                return;
            }

            var players = BasePlayer.activePlayerList
                .Where(player => player != null && player.IsConnected)
                .Take(Math.Max(1, _config.MaxPlayersPerSnapshot))
                .Select(player => BuildPlayer(player, true))
                .ToList();

            SendEvent(new EventEnvelope
            {
                EventType = "online_snapshot",
                Severity = "info",
                Source = "oxide-plugin",
                Server = BuildServer(),
                Players = players,
                Payload = new Dictionary<string, object>
                {
                    ["online_players"] = players.Count,
                    ["sleeping_players"] = BasePlayer.sleepingPlayerList.Count
                }
            });

            if (_config.SendTeamSnapshots)
            {
                SendTeamSnapshots(players);
            }
        }

        private void SendTeamSnapshots(List<PlayerSnapshot> onlinePlayers)
        {
            var groups = onlinePlayers
                .Where(player => !string.IsNullOrEmpty(player.TeamId))
                .GroupBy(player => player.TeamId)
                .Where(group => group.Count() > 1);

            foreach (var group in groups)
            {
                SendEvent(new EventEnvelope
                {
                    EventType = "team_snapshot",
                    Severity = "info",
                    Source = "oxide-plugin",
                    Server = BuildServer(),
                    Team = new TeamSnapshot
                    {
                        Id = group.Key,
                        Name = group.First().ClanTag,
                        Members = group.ToList()
                    },
                    Payload = new Dictionary<string, object>
                    {
                        ["team_id"] = group.Key,
                        ["member_count"] = group.Count()
                    }
                });
            }
        }

        private void SendPlayerEvent(string eventType, BasePlayer player, string severity, Dictionary<string, object> payload = null, bool online = true)
        {
            var snapshot = BuildPlayer(player, online);
            var related = RelatedTeamPlayers(player, snapshot.TeamId, "same_team_snapshot", "same live Rust team", 40);
            SendEvent(new EventEnvelope
            {
                EventType = eventType,
                Severity = severity,
                Source = "oxide-plugin",
                Server = BuildServer(),
                Player = snapshot,
                RelatedPlayers = related,
                Payload = payload ?? new Dictionary<string, object>()
            });
        }

        private void SendEvent(EventEnvelope envelope)
        {
            if (!IsConfigured())
            {
                return;
            }

            envelope.OccurredAt = DateTime.UtcNow.ToString("o");
            var body = JsonConvert.SerializeObject(envelope, Formatting.None, new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore
            });
            var headers = new Dictionary<string, string>
            {
                ["Content-Type"] = "application/json",
                ["X-RustControl-Signature"] = "sha256=" + HmacSha256(body, _config.WebhookSecret)
            };

            webrequest.Enqueue(_config.WebhookUrl, body, (code, response) =>
            {
                if (code < 200 || code >= 300)
                {
                    PrintWarning($"RustControl ingest failed: HTTP {code} {response}");
                    return;
                }
                if (_config.DebugLogging)
                {
                    Puts($"RustControl event sent: {envelope.EventType}");
                }
            }, this, RequestMethod.POST, headers, Math.Max(3f, _config.RequestTimeoutSeconds));
        }

        private ServerSnapshot BuildServer()
        {
            return new ServerSnapshot
            {
                BattleMetricsServerId = _config.BattleMetricsServerId,
                Name = string.IsNullOrEmpty(_config.ServerName) ? ConVar.Server.hostname : _config.ServerName,
                IP = ConVar.Server.ip,
                Port = ConVar.Server.port,
                Status = "online"
            };
        }

        private PlayerSnapshot BuildPlayer(BasePlayer player, bool online)
        {
            var team = RelationshipManager.ServerInstance?.FindPlayersTeam(player.userID);
            var pos = player.transform.position;
            var teamId = team != null ? team.teamID.ToString() : "";
            return new PlayerSnapshot
            {
                SteamId = player.UserIDString,
                Name = player.displayName,
                ClanTag = ExtractClanTag(player.displayName),
                TeamId = teamId,
                IsOnline = online,
                Position = new PositionSnapshot { X = pos.x, Y = pos.y, Z = pos.z },
                MapGrid = WorldToGrid(pos),
                Health = player.Health(),
                Sleeping = player.IsSleeping()
            };
        }

        private List<RelatedPlayer> RelatedTeamPlayers(BasePlayer player, string teamId, string evidenceType, string reason, int scoreDelta)
        {
            var team = RelationshipManager.ServerInstance?.FindPlayersTeam(player.userID);
            if (team == null)
            {
                return new List<RelatedPlayer>();
            }

            var related = new List<RelatedPlayer>();
            foreach (var member in team.members)
            {
                if (member == player.userID)
                {
                    continue;
                }
                var teammate = BasePlayer.FindByID(member);
                related.Add(new RelatedPlayer
                {
                    SteamId = member.ToString(),
                    Name = teammate?.displayName ?? "",
                    TeamId = teamId,
                    EvidenceType = evidenceType,
                    Reason = reason,
                    ScoreDelta = scoreDelta
                });
            }
            return related;
        }

        private string WorldToGrid(Vector3 position)
        {
            var worldSize = TerrainMeta.Size.x;
            if (worldSize <= 0f)
            {
                return "";
            }
            var cellSize = Math.Max(50f, _config.GridCellSize);
            var columns = Math.Max(1, Mathf.CeilToInt(worldSize / cellSize));
            var half = worldSize / 2f;
            var x = Mathf.Clamp(position.x + half, 0f, worldSize - 1f);
            var z = Mathf.Clamp(half - position.z, 0f, worldSize - 1f);
            var col = Mathf.Clamp(Mathf.FloorToInt(x / cellSize), 0, columns - 1);
            var row = Mathf.Clamp(Mathf.FloorToInt(z / cellSize) + 1, 1, columns);
            return ColumnName(col) + row;
        }

        private string ColumnName(int index)
        {
            var name = "";
            index++;
            while (index > 0)
            {
                index--;
                name = (char)('A' + (index % 26)) + name;
                index /= 26;
            }
            return name;
        }

        private string ExtractClanTag(string name)
        {
            if (string.IsNullOrEmpty(name) || name[0] != '[')
            {
                return "";
            }
            var end = name.IndexOf(']');
            if (end <= 1 || end > 12)
            {
                return "";
            }
            return name.Substring(1, end - 1);
        }

        private bool IsConfigured()
        {
            return !string.IsNullOrWhiteSpace(_config?.WebhookUrl) && !string.IsNullOrWhiteSpace(_config.WebhookSecret);
        }

        private string HmacSha256(string body, string secret)
        {
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
            {
                var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(body));
                return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
            }
        }

        private string Truncate(string value, int max)
        {
            if (string.IsNullOrEmpty(value) || value.Length <= max)
            {
                return value ?? "";
            }
            return value.Substring(0, max);
        }

        private class EventEnvelope
        {
            [JsonProperty("event_type")]
            public string EventType;

            [JsonProperty("severity")]
            public string Severity;

            [JsonProperty("source")]
            public string Source;

            [JsonProperty("server")]
            public ServerSnapshot Server;

            [JsonProperty("player")]
            public PlayerSnapshot Player;

            [JsonProperty("players")]
            public List<PlayerSnapshot> Players;

            [JsonProperty("related_players")]
            public List<RelatedPlayer> RelatedPlayers;

            [JsonProperty("team")]
            public TeamSnapshot Team;

            [JsonProperty("payload")]
            public Dictionary<string, object> Payload;

            [JsonProperty("occurred_at")]
            public string OccurredAt;
        }

        private class ServerSnapshot
        {
            [JsonProperty("battlemetrics_server_id")]
            public string BattleMetricsServerId;

            [JsonProperty("name")]
            public string Name;

            [JsonProperty("ip")]
            public string IP;

            [JsonProperty("port")]
            public int Port;

            [JsonProperty("status")]
            public string Status;
        }

        private class PlayerSnapshot
        {
            [JsonProperty("steam_id")]
            public string SteamId;

            [JsonProperty("name")]
            public string Name;

            [JsonProperty("clan_tag")]
            public string ClanTag;

            [JsonProperty("team_id")]
            public string TeamId;

            [JsonProperty("is_online")]
            public bool IsOnline;

            [JsonProperty("position")]
            public PositionSnapshot Position;

            [JsonProperty("map_grid")]
            public string MapGrid;

            [JsonProperty("health")]
            public float Health;

            [JsonProperty("sleeping")]
            public bool Sleeping;
        }

        private class RelatedPlayer
        {
            [JsonProperty("steam_id")]
            public string SteamId;

            [JsonProperty("name")]
            public string Name;

            [JsonProperty("team_id")]
            public string TeamId;

            [JsonProperty("evidence_type")]
            public string EvidenceType;

            [JsonProperty("reason")]
            public string Reason;

            [JsonProperty("score_delta")]
            public int ScoreDelta;
        }

        private class TeamSnapshot
        {
            [JsonProperty("id")]
            public string Id;

            [JsonProperty("name")]
            public string Name;

            [JsonProperty("members")]
            public List<PlayerSnapshot> Members;
        }

        private class PositionSnapshot
        {
            [JsonProperty("x")]
            public float X;

            [JsonProperty("y")]
            public float Y;

            [JsonProperty("z")]
            public float Z;
        }
    }
}
