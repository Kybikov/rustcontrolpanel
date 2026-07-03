using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Oxide.Core.Libraries.Covalence;
using Oxide.Core.Libraries;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("RustControlPanel", "WaterMelon", "0.1.3")]
    [Description("Streams Rust player, team, combat, command, and moderation telemetry into Rust Control Panel.")]
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

            [JsonProperty("send_command_usage_events")]
            public bool SendCommandUsageEvents = true;

            [JsonProperty("send_server_command_events")]
            public bool SendServerCommandEvents = false;

            [JsonProperty("send_admin_action_events")]
            public bool SendAdminActionEvents = true;

            [JsonProperty("max_command_args")]
            public int MaxCommandArgs = 12;

            [JsonProperty("send_death_events")]
            public bool SendDeathEvents = true;

            [JsonProperty("send_wipe_events")]
            public bool SendWipeEvents = true;

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

        private void OnPlayerCommand(BasePlayer player, string command, string[] args)
        {
            if (!_config.SendCommandUsageEvents || player == null || string.IsNullOrWhiteSpace(command))
            {
                return;
            }
            SendCommandUsageEvent("player_command", player, command, args);
        }

        private void OnServerCommand(ConsoleSystem.Arg arg)
        {
            if (!_config.SendCommandUsageEvents || arg?.cmd == null)
            {
                return;
            }

            var player = arg.Player();
            if (player == null && !_config.SendServerCommandEvents)
            {
                return;
            }

            var command = arg.cmd.FullName ?? "";
            if (IsChatCommand(command))
            {
                return;
            }

            SendCommandUsageEvent(player == null ? "server_command" : "player_console_command", player, command, arg.Args);
        }

        private void OnUserKicked(IPlayer player, string reason)
        {
            if (!_config.SendAdminActionEvents || player == null)
            {
                return;
            }
            SendAdminTargetEvent("player_kicked", "kick", player.Name, player.Id, reason, 0);
        }

        private void OnUserBanned(string name, string id, string address, string reason, long expiry)
        {
            if (!_config.SendAdminActionEvents)
            {
                return;
            }
            SendAdminTargetEvent("player_banned", "ban", name, id, reason, expiry);
        }

        private void OnUserUnbanned(string name, string id, string address)
        {
            if (!_config.SendAdminActionEvents)
            {
                return;
            }
            SendAdminTargetEvent("player_unbanned", "unban", name, id, "", 0);
        }

        private void OnNewSave(string filename)
        {
            SendWipeEvent("map_wipe", filename, false);
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

        [ConsoleCommand("rustcontrol.wipe")]
        private void CmdWipe(ConsoleSystem.Arg arg)
        {
            var wipeType = arg?.Args != null && arg.Args.Length > 0 ? arg.Args[0] : "manual_wipe";
            SendWipeEvent(wipeType, "", true);
            Puts($"RustControlPanel wipe event queued: {wipeType}.");
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

        private void SendCommandUsageEvent(string commandSource, BasePlayer player, string command, string[] args)
        {
            var payload = BuildCommandPayload(commandSource, player, command, args);
            var envelope = new EventEnvelope
            {
                EventType = "command_usage",
                Severity = "info",
                Source = "oxide-plugin",
                Server = BuildServer(),
                Payload = payload
            };
            if (player != null)
            {
                envelope.Player = BuildPlayer(player, true);
                envelope.RelatedPlayers = RelatedTeamPlayers(player, envelope.Player.TeamId, "same_team_command_context", "same live Rust team during command usage", 8);
            }
            SendEvent(envelope);
        }

        private void SendAdminTargetEvent(string eventType, string action, string name, string id, string reason, long expiry)
        {
            var payload = new Dictionary<string, object>
            {
                ["action"] = action,
                ["target"] = id ?? "",
                ["target_name"] = name ?? "",
                ["reason"] = Truncate(reason, 250),
                ["expiry"] = expiry
            };
            var envelope = new EventEnvelope
            {
                EventType = eventType,
                Severity = "warning",
                Source = "oxide-plugin",
                Server = BuildServer(),
                Payload = payload
            };
            if (LooksSteamId(id))
            {
                envelope.Player = new PlayerSnapshot
                {
                    SteamId = id,
                    Name = name ?? "",
                    IsOnline = false
                };
            }
            SendEvent(envelope);
        }

        private Dictionary<string, object> BuildCommandPayload(string commandSource, BasePlayer player, string command, string[] args)
        {
            var safeCommand = SanitizeCommandPart(command);
            var safeArgs = SafeCommandArgs(args);
            var action = ModerationAction(command);
            var payload = new Dictionary<string, object>
            {
                ["command_source"] = commandSource,
                ["command"] = safeCommand,
                ["args"] = safeArgs,
                ["raw_command"] = BuildRawCommand(safeCommand, safeArgs, commandSource == "player_command"),
                ["actor_steam_id"] = player?.UserIDString ?? "",
                ["actor_name"] = player?.displayName ?? "",
                ["actor_auth_level"] = player?.net?.connection != null ? (int)player.net.connection.authLevel : 0
            };
            if (!string.IsNullOrEmpty(action))
            {
                payload["action"] = action;
                payload["target"] = FirstCommandArg(args);
            }
            return payload;
        }

        private List<string> SafeCommandArgs(string[] args)
        {
            return (args ?? new string[0])
                .Take(Math.Max(1, _config.MaxCommandArgs))
                .Select(SanitizeCommandPart)
                .ToList();
        }

        private string BuildRawCommand(string command, List<string> args, bool playerChatCommand)
        {
            var prefix = playerChatCommand ? "/" : "";
            var joined = args != null && args.Count > 0 ? " " + string.Join(" ", args) : "";
            return Truncate(prefix + command + joined, 500);
        }

        private string SanitizeCommandPart(string value)
        {
            value = Truncate(value ?? "", 120);
            var lowered = value.ToLowerInvariant();
            if (lowered.Contains("password") || lowered.Contains("secret") || lowered.Contains("token") || lowered.Contains("apikey") || lowered.Contains("webhook") || lowered.Contains("rcon.login"))
            {
                return "[redacted]";
            }
            return value;
        }

        private string FirstCommandArg(string[] args)
        {
            var value = args != null && args.Length > 0 ? args[0] : "";
            return SanitizeCommandPart(value);
        }

        private string ModerationAction(string command)
        {
            var normalized = (command ?? "").Trim().TrimStart('/').ToLowerInvariant();
            var leaf = normalized.Split('.').LastOrDefault() ?? normalized;
            if (leaf.StartsWith("unban")) return "unban";
            if (leaf.StartsWith("unmute")) return "unmute";
            if (leaf == "ban" || leaf.StartsWith("banid")) return "ban";
            if (leaf.StartsWith("mute")) return "mute";
            if (leaf.StartsWith("kick")) return "kick";
            return "";
        }

        private bool IsChatCommand(string command)
        {
            var normalized = (command ?? "").Trim().ToLowerInvariant();
            return normalized == "chat.say" || normalized == "chat.teamsay" || normalized == "chat.localsay";
        }

        private void SendWipeEvent(string wipeType, string filename, bool manual)
        {
            if (!_config.SendWipeEvents || !IsConfigured())
            {
                return;
            }

            var now = DateTime.UtcNow;
            SendEvent(new EventEnvelope
            {
                EventType = "wipe_detected",
                Severity = "warning",
                Source = "oxide-plugin",
                Server = BuildServer(),
                Payload = new Dictionary<string, object>
                {
                    ["wipe_type"] = string.IsNullOrWhiteSpace(wipeType) ? "map_wipe" : wipeType,
                    ["wipe_at"] = now.ToString("o"),
                    ["save_filename"] = filename ?? "",
                    ["manual"] = manual
                }
            });
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
            var mapName = ConVar.Server.level ?? "";
            var mapSize = ConVar.Server.worldsize > 0 ? ConVar.Server.worldsize : Mathf.RoundToInt(TerrainMeta.Size.x);
            var mapSeed = ConVar.Server.seed;
            return new ServerSnapshot
            {
                BattleMetricsServerId = _config.BattleMetricsServerId,
                Name = string.IsNullOrEmpty(_config.ServerName) ? ConVar.Server.hostname : _config.ServerName,
                IP = ConVar.Server.ip,
                Port = ConVar.Server.port,
                Status = "online",
                RustMap = mapName,
                RustWorldSeed = mapSeed,
                RustWorldSize = mapSize,
                MapHash = BuildPluginMapHash(mapName, mapSeed, mapSize)
            };
        }

        private string BuildPluginMapHash(string mapName, int seed, int size)
        {
            var normalizedMap = string.IsNullOrWhiteSpace(mapName) ? "unknown" : mapName.Trim().ToLowerInvariant();
            if (seed <= 0 && size <= 0 && normalizedMap == "unknown")
            {
                return "";
            }
            return $"plugin:{normalizedMap}:seed:{seed}:size:{size}";
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

        private bool LooksSteamId(string value)
        {
            return !string.IsNullOrWhiteSpace(value) && value.Length >= 16 && value.All(char.IsDigit);
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

            [JsonProperty("rust_map")]
            public string RustMap;

            [JsonProperty("rust_world_seed")]
            public int RustWorldSeed;

            [JsonProperty("rust_world_size")]
            public int RustWorldSize;

            [JsonProperty("map_hash")]
            public string MapHash;
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
