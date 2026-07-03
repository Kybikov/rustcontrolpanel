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
    [Info("RustControlPanel", "WaterMelon", "0.1.7")]
    [Description("Streams Rust player, team, combat, world, command, and moderation telemetry into Rust Control Panel.")]
    public class RustControlPanel : RustPlugin
    {
        private PluginConfig _config;
        private Timer _snapshotTimer;
        private readonly Dictionary<string, float> _raidEventTimes = new Dictionary<string, float>();
        private readonly Dictionary<string, float> _worldEventTimes = new Dictionary<string, float>();

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

            [JsonProperty("send_clan_events")]
            public bool SendClanEvents = true;

            [JsonProperty("max_command_args")]
            public int MaxCommandArgs = 12;

            [JsonProperty("send_death_events")]
            public bool SendDeathEvents = true;

            [JsonProperty("send_raid_events")]
            public bool SendRaidEvents = true;

            [JsonProperty("raid_event_cooldown_seconds")]
            public float RaidEventCooldownSeconds = 20f;

            [JsonProperty("send_world_events")]
            public bool SendWorldEvents = true;

            [JsonProperty("world_event_cooldown_seconds")]
            public float WorldEventCooldownSeconds = 30f;

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
                ["connection_ip_hash"] = HashSensitiveValue(player.net?.connection?.ipaddress ?? ""),
                ["connection_ip_present"] = !string.IsNullOrWhiteSpace(player.net?.connection?.ipaddress ?? "")
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

        private object OnEntityTakeDamage(BaseCombatEntity entity, HitInfo info)
        {
            if (!_config.SendRaidEvents || entity == null || info == null || !IsRaidTarget(entity) || !IsRaidDamage(info))
            {
                return null;
            }
            SendRaidEvent("raid_activity", entity, info, "warning", false);
            return null;
        }

        private void OnEntityDeath(BaseCombatEntity entity, HitInfo info)
        {
            if (_config.SendWorldEvents && entity != null)
            {
                SendWorldEntityDeath(entity, info);
            }

            if (!_config.SendRaidEvents || entity == null || info == null || !IsRaidTarget(entity) || !IsRaidDamage(info))
            {
                return;
            }
            SendRaidEvent("raid_destroyed", entity, info, "critical", true);
        }

        private void OnEntitySpawned(BaseNetworkable instance)
        {
            if (!_config.SendWorldEvents)
            {
                return;
            }

            var entity = instance as BaseEntity;
            var kind = WorldEventKind(entity);
            if (string.IsNullOrEmpty(kind))
            {
                return;
            }

            SendWorldEvent(
                "world_entity_spawned",
                kind,
                WorldEventTitle(kind, "spawned"),
                WorldEventSeverity(kind, false),
                entity,
                null,
                new Dictionary<string, object> { ["phase"] = "spawned" },
                true
            );
        }

        private object OnPatrolHelicopterKill(PatrolHelicopter instance, HitInfo info)
        {
            if (_config.SendWorldEvents && instance != null)
            {
                SendWorldEvent(
                    "world_entity_destroyed",
                    "heli",
                    "Patrol helicopter destroyed",
                    "warning",
                    instance,
                    info?.InitiatorPlayer,
                    new Dictionary<string, object>
                    {
                        ["phase"] = "destroyed",
                        ["damage_type"] = info?.damageTypes?.GetMajorityDamageType().ToString() ?? "",
                        ["weapon"] = info?.WeaponPrefab?.ShortPrefabName ?? ""
                    },
                    false
                );
            }
            return null;
        }

        private object OnCargoShipSpawnCrate(CargoShip instance)
        {
            if (_config.SendWorldEvents && instance != null)
            {
                SendWorldEvent(
                    "world_loot_spawned",
                    "cargo",
                    "Cargo ship loot spawned",
                    "info",
                    instance,
                    null,
                    new Dictionary<string, object> { ["phase"] = "loot_spawned" },
                    true
                );
            }
            return null;
        }

        private void OnCrateHack(HackableLockedCrate instance)
        {
            if (!_config.SendWorldEvents || instance == null)
            {
                return;
            }

            SendWorldEvent(
                "world_crate_hacked",
                "locked_crate",
                "Locked crate hacking started",
                "warning",
                instance,
                null,
                new Dictionary<string, object> { ["phase"] = "hack_started" },
                false
            );
        }

        private void OnAirdrop(CargoPlane instance, Vector3 newDropPosition)
        {
            if (!_config.SendWorldEvents || instance == null)
            {
                return;
            }

            SendWorldEventAt(
                "world_airdrop_inbound",
                "airdrop",
                "Airdrop inbound",
                "info",
                instance,
                newDropPosition,
                null,
                new Dictionary<string, object> { ["phase"] = "inbound" },
                true
            );
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

        private void OnClanCreated(LocalClan localClan, ulong leaderSteamId)
        {
            SendClanEvent("clan_created", "created", localClan, leaderSteamId, 0, "info");
        }

        private void OnClanDisbanded(LocalClan localClan, ulong bySteamId)
        {
            SendClanEvent("clan_disbanded", "disbanded", localClan, bySteamId, bySteamId, "warning");
        }

        private void OnClanMemberAdded(long clanId, ulong steamId)
        {
            SendClanEvent("clan_member_added", "member_added", clanId, steamId, 0, "info");
        }

        private void OnClanMemberLeft(LocalClan localClan, ulong steamId)
        {
            SendClanEvent("clan_member_left", "member_left", localClan, steamId, 0, "info");
        }

        private void OnClanMemberKicked(LocalClan localClan, ulong steamId, ulong bySteamId)
        {
            SendClanEvent("clan_member_kicked", "member_kicked", localClan, steamId, bySteamId, "warning");
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

        private void SendClanEvent(string eventType, string action, LocalClan localClan, ulong steamId, ulong actorSteamId, string severity)
        {
            SendClanEvent(eventType, action, localClan?.ClanId ?? 0, steamId, actorSteamId, severity);
        }

        private void SendClanEvent(string eventType, string action, long clanId, ulong steamId, ulong actorSteamId, string severity)
        {
            if (!_config.SendClanEvents || clanId == 0)
            {
                return;
            }

            var member = BasePlayer.FindByID(steamId) ?? BasePlayer.FindSleeping(steamId);
            var actor = actorSteamId != 0 ? BasePlayer.FindByID(actorSteamId) ?? BasePlayer.FindSleeping(actorSteamId) : null;
            var payload = new Dictionary<string, object>
            {
                ["type"] = "clan",
                ["action"] = action,
                ["clan_id"] = clanId.ToString(),
                ["steam_id"] = steamId.ToString(),
                ["member_name"] = member?.displayName ?? "",
                ["actor_steam_id"] = actorSteamId != 0 ? actorSteamId.ToString() : "",
                ["actor_name"] = actor?.displayName ?? ""
            };
            var envelope = new EventEnvelope
            {
                EventType = eventType,
                Severity = severity,
                Source = "oxide-plugin",
                Server = BuildServer(),
                Payload = payload,
                Player = member != null ? BuildPlayer(member, member.IsConnected) : new PlayerSnapshot
                {
                    SteamId = steamId.ToString(),
                    Name = "",
                    IsOnline = false
                }
            };
            if (actorSteamId != 0 && actorSteamId != steamId)
            {
                envelope.RelatedPlayers = new List<RelatedPlayer>
                {
                    new RelatedPlayer
                    {
                        SteamId = actorSteamId.ToString(),
                        Name = actor?.displayName ?? "",
                        EvidenceType = "clan_action_actor",
                        Reason = "performed clan membership action",
                        ScoreDelta = 2
                    }
                };
            }
            SendEvent(envelope);
        }

        private void SendRaidEvent(string eventType, BaseCombatEntity entity, HitInfo info, string severity, bool destroyed)
        {
            if (!destroyed && !ShouldEmitRaidEvent(entity, info))
            {
                return;
            }

            var position = entity.transform.position;
            var attacker = info.InitiatorPlayer;
            var target = EntityName(entity);
            var weapon = info.WeaponPrefab?.ShortPrefabName ?? "";
            var damageType = info.damageTypes?.GetMajorityDamageType().ToString() ?? "";
            var payload = new Dictionary<string, object>
            {
                ["type"] = "raid",
                ["title"] = destroyed ? "Raid target destroyed" : "Raid damage detected",
                ["target_prefab"] = target,
                ["target_owner_id"] = entity.OwnerID.ToString(),
                ["damage_type"] = damageType,
                ["weapon"] = weapon,
                ["map_grid"] = WorldToGrid(position),
                ["position"] = new PositionSnapshot { X = position.x, Y = position.y, Z = position.z },
                ["destroyed"] = destroyed,
                ["attacker_steam_id"] = attacker?.UserIDString ?? "",
                ["attacker_name"] = attacker?.displayName ?? ""
            };
            var envelope = new EventEnvelope
            {
                EventType = eventType,
                Severity = severity,
                Source = "oxide-plugin",
                Server = BuildServer(),
                Payload = payload
            };
            if (attacker != null)
            {
                envelope.Player = BuildPlayer(attacker, true);
                envelope.RelatedPlayers = RelatedTeamPlayers(attacker, envelope.Player.TeamId, "same_team_raid_context", "same live Rust team near raid damage", 12);
            }
            SendEvent(envelope);
        }

        private void SendWorldEntityDeath(BaseCombatEntity entity, HitInfo info)
        {
            var kind = WorldEventKind(entity);
            if (string.IsNullOrEmpty(kind))
            {
                return;
            }

            if (kind == "heli")
            {
                return;
            }

            SendWorldEvent(
                "world_entity_destroyed",
                kind,
                WorldEventTitle(kind, "destroyed"),
                WorldEventSeverity(kind, true),
                entity,
                info?.InitiatorPlayer,
                new Dictionary<string, object>
                {
                    ["phase"] = "destroyed",
                    ["damage_type"] = info?.damageTypes?.GetMajorityDamageType().ToString() ?? "",
                    ["weapon"] = info?.WeaponPrefab?.ShortPrefabName ?? ""
                },
                false
            );
        }

        private void SendWorldEvent(string eventType, string kind, string title, string severity, BaseEntity entity, BasePlayer actor, Dictionary<string, object> extra, bool useCooldown)
        {
            if (entity == null)
            {
                return;
            }
            SendWorldEventAt(eventType, kind, title, severity, entity, entity.transform.position, actor, extra, useCooldown);
        }

        private void SendWorldEventAt(string eventType, string kind, string title, string severity, BaseEntity entity, Vector3 position, BasePlayer actor, Dictionary<string, object> extra, bool useCooldown)
        {
            if (!_config.SendWorldEvents || entity == null || string.IsNullOrEmpty(kind))
            {
                return;
            }
            if (useCooldown && !ShouldEmitWorldEvent(eventType, kind, entity, position))
            {
                return;
            }

            var payload = new Dictionary<string, object>
            {
                ["type"] = kind,
                ["title"] = title,
                ["entity_prefab"] = EntityName(entity),
                ["entity_id"] = entity.net?.ID.ToString() ?? "",
                ["owner_id"] = entity.OwnerID.ToString(),
                ["map_grid"] = WorldToGrid(position),
                ["position"] = new PositionSnapshot { X = position.x, Y = position.y, Z = position.z }
            };
            if (extra != null)
            {
                foreach (var pair in extra)
                {
                    payload[pair.Key] = pair.Value;
                }
            }

            var envelope = new EventEnvelope
            {
                EventType = eventType,
                Severity = severity,
                Source = "oxide-plugin",
                Server = BuildServer(),
                Payload = payload
            };
            if (actor != null)
            {
                envelope.Player = BuildPlayer(actor, true);
                envelope.RelatedPlayers = RelatedTeamPlayers(actor, envelope.Player.TeamId, "same_team_world_event_context", "same live Rust team near world event", 10);
            }
            SendEvent(envelope);
        }

        private bool ShouldEmitWorldEvent(string eventType, string kind, BaseEntity entity, Vector3 position)
        {
            var key = $"{eventType}:{kind}:{EntityNetworkId(entity)}:{WorldToGrid(position)}";
            var now = Time.realtimeSinceStartup;
            var cooldown = Math.Max(5f, _config.WorldEventCooldownSeconds);
            if (_worldEventTimes.Count > 512)
            {
                foreach (var expired in _worldEventTimes.Where(pair => now - pair.Value > cooldown * 4f).Select(pair => pair.Key).ToList())
                {
                    _worldEventTimes.Remove(expired);
                }
            }
            if (_worldEventTimes.TryGetValue(key, out var last) && now - last < cooldown)
            {
                return false;
            }
            _worldEventTimes[key] = now;
            return true;
        }

        private string EntityNetworkId(BaseEntity entity)
        {
            var value = entity?.net?.ID.ToString() ?? "";
            if (!string.IsNullOrEmpty(value) && value != "0")
            {
                return value;
            }
            var position = entity?.transform.position ?? Vector3.zero;
            return $"{EntityName(entity)}:{Mathf.RoundToInt(position.x)}:{Mathf.RoundToInt(position.z)}";
        }

        private string WorldEventKind(BaseEntity entity)
        {
            var name = EntityName(entity);
            if (string.IsNullOrEmpty(name))
            {
                return "";
            }
            if (name.Contains("patrolhelicopter") || name.Contains("patrol_helicopter"))
            {
                return "heli";
            }
            if (name.Contains("bradleyapc") || name.Contains("bradley_apc") || name.Contains("bradley"))
            {
                return "bradley";
            }
            if (name.Contains("cargoship") || name.Contains("cargo_ship"))
            {
                return "cargo";
            }
            if (name.Contains("ch47") || name.Contains("chinook"))
            {
                return "chinook";
            }
            if (name.Contains("hackablelockedcrate") || name.Contains("lockedcrate") || name.Contains("locked_crate"))
            {
                return "locked_crate";
            }
            if (name.Contains("supply_drop") || name.Contains("supplydrop"))
            {
                return "airdrop";
            }
            return "";
        }

        private string WorldEventTitle(string kind, string phase)
        {
            switch (kind)
            {
                case "heli":
                    return phase == "destroyed" ? "Patrol helicopter destroyed" : "Patrol helicopter spawned";
                case "bradley":
                    return phase == "destroyed" ? "Bradley APC destroyed" : "Bradley APC spawned";
                case "cargo":
                    return phase == "destroyed" ? "Cargo ship left map" : "Cargo ship spawned";
                case "chinook":
                    return phase == "destroyed" ? "Chinook destroyed" : "Chinook spawned";
                case "locked_crate":
                    return phase == "destroyed" ? "Locked crate removed" : "Locked crate spawned";
                case "airdrop":
                    return phase == "destroyed" ? "Airdrop removed" : "Airdrop spawned";
                default:
                    return $"World event {phase}";
            }
        }

        private string WorldEventSeverity(string kind, bool destroyed)
        {
            if (destroyed && (kind == "heli" || kind == "bradley"))
            {
                return "warning";
            }
            if (kind == "locked_crate")
            {
                return "warning";
            }
            return "info";
        }

        private bool ShouldEmitRaidEvent(BaseCombatEntity entity, HitInfo info)
        {
            var position = entity.transform.position;
            var attackerId = info.InitiatorPlayer?.UserIDString ?? "world";
            var key = $"{WorldToGrid(position)}:{EntityName(entity)}:{attackerId}";
            var now = Time.realtimeSinceStartup;
            var cooldown = Math.Max(5f, _config.RaidEventCooldownSeconds);
            if (_raidEventTimes.Count > 512)
            {
                foreach (var expired in _raidEventTimes.Where(pair => now - pair.Value > cooldown * 4f).Select(pair => pair.Key).ToList())
                {
                    _raidEventTimes.Remove(expired);
                }
            }
            if (_raidEventTimes.TryGetValue(key, out var last) && now - last < cooldown)
            {
                return false;
            }
            _raidEventTimes[key] = now;
            return true;
        }

        private bool IsRaidTarget(BaseCombatEntity entity)
        {
            var name = EntityName(entity);
            if (name == "" || name.Contains("player") || name.Contains("corpse") || name.Contains("npc"))
            {
                return false;
            }
            return name.Contains("building") || name.Contains("foundation") || name.Contains("wall") || name.Contains("floor") ||
                   name.Contains("roof") || name.Contains("door") || name.Contains("window") || name.Contains("shutter") ||
                   name.Contains("gate") || name.Contains("external") || name.Contains("cupboard") || name.Contains("barricade") ||
                   name.Contains("furnace") || name.Contains("locker") || name.Contains("box") || name.Contains("vending") ||
                   name.Contains("turret") || name.Contains("sam_site") || name.Contains("deployable");
        }

        private bool IsRaidDamage(HitInfo info)
        {
            var damageType = info.damageTypes?.GetMajorityDamageType().ToString().ToLowerInvariant() ?? "";
            var weapon = info.WeaponPrefab?.ShortPrefabName?.ToLowerInvariant() ?? "";
            var initiator = info.Initiator?.ShortPrefabName?.ToLowerInvariant() ?? "";
            return damageType.Contains("explosion") || damageType.Contains("heat") ||
                   weapon.Contains("rocket") || weapon.Contains("explosive") || weapon.Contains("satchel") ||
                   weapon.Contains("c4") || weapon.Contains("grenade") || weapon.Contains("beancan") || weapon.Contains("mlrs") ||
                   initiator.Contains("rocket") || initiator.Contains("explosive") || initiator.Contains("satchel") ||
                   initiator.Contains("c4") || initiator.Contains("grenade") || initiator.Contains("fireball");
        }

        private string EntityName(BaseEntity entity)
        {
            return ((entity?.ShortPrefabName ?? entity?.name ?? "")).ToLowerInvariant();
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

        private string HashSensitiveValue(string value)
        {
            value = (value ?? "").Trim();
            if (string.IsNullOrEmpty(value) || string.IsNullOrWhiteSpace(_config?.WebhookSecret))
            {
                return "";
            }
            return HmacSha256(value, _config.WebhookSecret);
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
