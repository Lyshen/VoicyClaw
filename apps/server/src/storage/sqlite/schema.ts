import { db } from "./client"
import { ensureColumn } from "./shared"

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_identities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_subject TEXT NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_subject_idx
  ON user_identities(provider, provider_subject);

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS workspaces_default_owner_idx
  ON workspaces(owner_user_id)
  WHERE is_default = 1;

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    project_type TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    bot_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS projects_starter_workspace_idx
  ON projects(workspace_id)
  WHERE project_type = 'starter';

  CREATE TABLE IF NOT EXISTS platform_keys (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    label TEXT,
    channel_id TEXT NOT NULL,
    workspace_id TEXT,
    project_id TEXT,
    key_type TEXT NOT NULL DEFAULT 'standard',
    created_by_user_id TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bot_registrations (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    bot_name TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    platform_key_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_connected_at TEXT,
    UNIQUE (bot_id, channel_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_key_id) REFERENCES platform_keys(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS billing_rates (
    id TEXT PRIMARY KEY,
    feature TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    billing_metric TEXT NOT NULL,
    unit_size INTEGER NOT NULL,
    retail_credits_millis INTEGER NOT NULL,
    provider_cost_usd_micros INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS billing_rates_feature_provider_metric_idx
  ON billing_rates(feature, provider_id, billing_metric);

  CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    project_id TEXT,
    channel_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    feature TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    status TEXT NOT NULL,
    input_chars INTEGER NOT NULL DEFAULT 0,
    output_audio_bytes INTEGER NOT NULL DEFAULT 0,
    output_audio_ms INTEGER NOT NULL DEFAULT 0,
    billing_rate_id TEXT,
    charged_credits_millis INTEGER NOT NULL DEFAULT 0,
    estimated_provider_cost_usd_micros INTEGER,
    error_message TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (billing_rate_id) REFERENCES billing_rates(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS usage_events_workspace_created_idx
  ON usage_events(workspace_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS usage_events_channel_created_idx
  ON usage_events(channel_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS workspace_allowance_ledger (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    credits_delta_millis INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS workspace_allowance_source_idx
  ON workspace_allowance_ledger(workspace_id, source_type, source_id);

  CREATE INDEX IF NOT EXISTS workspace_allowance_created_idx
  ON workspace_allowance_ledger(workspace_id, created_at DESC);
`)

ensureColumn("platform_keys", "workspace_id", "TEXT")
ensureColumn("platform_keys", "project_id", "TEXT")
ensureColumn("platform_keys", "key_type", "TEXT NOT NULL DEFAULT 'standard'")
ensureColumn("platform_keys", "created_by_user_id", "TEXT")

db.exec(`
  CREATE INDEX IF NOT EXISTS platform_keys_project_type_idx
  ON platform_keys(project_id, key_type);
`)
