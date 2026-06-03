"""
Initialization script for enterprise database setup.
Includes sharding, partitioning, and indexes.
"""

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ═══════════════════════════════════════════════════════════════════════════
-- Partitioned Messages Table (256 partitions for scalability)
-- ═══════════════════════════════════════════════════════════════════════════

-- Create base messages table with partitioning
CREATE TABLE IF NOT EXISTS messages_partitioned (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    content TEXT,
    
    -- Media fields
    media_url VARCHAR(500),
    media_type VARCHAR(50),
    media_size INTEGER,
    media_duration INTEGER,
    thumbnail_url VARCHAR(500),
    
    -- Message metadata
    status VARCHAR(20) DEFAULT 'sent',
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    
    -- Message relations
    replied_to_id UUID,
    forwarded_from_id UUID,
    forward_count INTEGER DEFAULT 0,
    
    -- Deletion
    is_deleted_sender BOOLEAN DEFAULT FALSE,
    is_deleted_receiver BOOLEAN DEFAULT FALSE,
    is_deleted_everyone BOOLEAN DEFAULT FALSE,
    disappear_at TIMESTAMP,
    
    -- Location
    latitude FLOAT,
    longitude FLOAT,
    location_name VARCHAR(255),
    is_live_location BOOLEAN DEFAULT FALSE,
    live_location_duration INTEGER,
    
    -- Link preview
    link_preview_title VARCHAR(255),
    link_preview_description TEXT,
    link_preview_image VARCHAR(500),
    link_preview_url VARCHAR(500),
    
    -- Contact
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    
    -- E2EE fields
    encrypted_payload TEXT,
    e2ee_header TEXT,
    e2ee_type INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
) PARTITION BY HASH (sender_id);

-- Create 256 partitions
DO $$
DECLARE i INTEGER;
BEGIN
    FOR i IN 0..255 LOOP
        EXECUTE 'CREATE TABLE IF NOT EXISTS messages_p' || i ||
                ' PARTITION OF messages_partitioned FOR VALUES WITH (MODULUS 256, REMAINDER ' || i || ')';
        
        -- Create indexes on each partition
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_p' || i || '_sender
                 ON messages_p' || i || ' (sender_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_p' || i || '_receiver
                 ON messages_p' || i || ' (receiver_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_p' || i || '_created
                 ON messages_p' || i || ' (created_at DESC)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_p' || i || '_conversation
                 ON messages_p' || i || ' (sender_id, receiver_id, created_at DESC)';
    END LOOP;
END
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- E2EE Key Management Tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS e2ee_key_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    
    -- Ed25519 Identity Key
    identity_key_pub TEXT NOT NULL,
    
    -- X25519 Signed PreKey
    signed_prekey_id INTEGER NOT NULL,
    signed_prekey_pub TEXT NOT NULL,
    signed_prekey_sig TEXT NOT NULL,
    
    -- Registration ID
    registration_id INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e2ee_bundle_user ON e2ee_key_bundles(user_id);
CREATE INDEX IF NOT EXISTS idx_e2ee_bundle_created ON e2ee_key_bundles(created_at);

-- One-time PreKeys Table
CREATE TABLE IF NOT EXISTS e2ee_one_time_prekeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_e2ee_otpk_user_unused
    ON e2ee_one_time_prekeys(user_id, is_used);
CREATE INDEX IF NOT EXISTS idx_e2ee_otpk_created
    ON e2ee_one_time_prekeys(created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- Security & Audit Tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) DEFAULT 'info',
    ip_address INET,
    user_agent VARCHAR(500),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_event
    ON security_audit_logs(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_audit_severity
    ON security_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_created
    ON security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type
    ON security_audit_logs(event_type);

-- JWT Blocklist (for token revocation)
CREATE TABLE IF NOT EXISTS jwt_blocklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti VARCHAR(64) NOT NULL UNIQUE,
    token_type VARCHAR(16) DEFAULT 'access',
    user_id UUID,
    revoked_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jwt_blocklist_jti ON jwt_blocklist(jti);
CREATE INDEX IF NOT EXISTS idx_jwt_blocklist_expires ON jwt_blocklist(expires_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- Subscription & Monetization Tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    plan VARCHAR(20) DEFAULT 'free',
    status VARCHAR(20) DEFAULT 'active',
    stripe_subscription_id VARCHAR(255),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_user ON subscription_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plan ON subscription_plans(plan);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON subscription_plans(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- Performance Tuning
-- ═══════════════════════════════════════════════════════════════════════════

-- VACUUM and ANALYZE for new tables
VACUUM ANALYZE e2ee_key_bundles;
VACUUM ANALYZE e2ee_one_time_prekeys;
VACUUM ANALYZE security_audit_logs;
VACUUM ANALYZE jwt_blocklist;
VACUUM ANALYZE subscription_plans;

-- Create statistics for query optimization
ANALYZE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Initial Data
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable extension for stats
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create system tables
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO system_config (key, value) VALUES
    ('db_version', '2.0.0'),
    ('last_migration', NOW()::TEXT),
    ('shards_count', '256')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Create audit log cleanup trigger (keep 365 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM security_audit_logs
    WHERE created_at < NOW() - INTERVAL '365 days';
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- Confirm initialization
-- ═══════════════════════════════════════════════════════════════════════════

-- Create initialization log
INSERT INTO system_config (key, value)
VALUES ('db_initialization_complete', NOW()::TEXT)
ON CONFLICT (key) DO UPDATE SET value = NOW()::TEXT;

SELECT 'Database initialization complete!' as status;
SELECT count(*) as partitions_created FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'messages_p%';
