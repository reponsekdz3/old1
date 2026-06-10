-- VipChat Database Initialization Script
-- This script is automatically run when MySQL container starts for the first time

-- Ensure UTF-8 support for international characters
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS vipchat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE vipchat;

-- Enable event scheduler for automated tasks
SET GLOBAL event_scheduler = ON;

-- Create indexes for performance (tables created by SQLAlchemy)
-- These will be added after first app start

-- Performance tuning
SET GLOBAL innodb_buffer_pool_size = 2147483648;  -- 2GB
SET GLOBAL max_connections = 1000;
SET GLOBAL innodb_flush_log_at_trx_commit = 2;

-- Success message
SELECT 'VipChat database initialized successfully!' AS Status;
