-- BRAHMO Governance Engine - Supabase Schema

-- Drop tables if they exist to allow clean re-initialization
DROP TABLE IF EXISTS edges;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS pulse_alerts;
DROP TABLE IF EXISTS knowledge_nodes;
DROP TABLE IF EXISTS hierarchy_levels;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;

-- 1. Organizations
CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb
);

-- 2. Users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT
);

-- 3. Hierarchy Levels
CREATE TABLE hierarchy_levels (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id),
    level_number INTEGER NOT NULL,
    level_name TEXT NOT NULL,
    department TEXT
);

-- 4. Knowledge Nodes
CREATE TABLE knowledge_nodes (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id),
    hierarchy_level_id TEXT REFERENCES hierarchy_levels(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    importance REAL DEFAULT 0.0,
    status TEXT NOT NULL,
    superseded_by TEXT,
    department TEXT,
    valid_until TIMESTAMPTZ,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Edges
CREATE TABLE edges (
    id TEXT PRIMARY KEY,
    source_id TEXT REFERENCES knowledge_nodes(id),
    target_id TEXT REFERENCES knowledge_nodes(id),
    edge_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Audit Logs
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    node_id TEXT,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    actor_id TEXT,
    org_id TEXT,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Pulse Alerts
CREATE TABLE pulse_alerts (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    user_id TEXT REFERENCES users(id),
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

