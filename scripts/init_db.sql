-- VipChat Database Initialization
CREATE DATABASE IF NOT EXISTS vipchat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vipchat;

-- Grant privileges
GRANT ALL PRIVILEGES ON vipchat.* TO 'vipchat'@'%';
FLUSH PRIVILEGES;

-- Tables will be created automatically by SQLAlchemy on first run
