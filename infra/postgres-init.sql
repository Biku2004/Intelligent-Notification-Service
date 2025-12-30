-- PostgreSQL Initialization Script
-- This script runs automatically when the container starts for the first time
-- It ensures the database is properly configured without requiring manual setup

-- Create database if not exists (already created via POSTGRES_DB env var)
-- notification_system database is auto-created

-- Set up connection limits and other configurations
ALTER DATABASE notification_system SET timezone TO 'UTC';

-- Create extensions (if needed in future)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE notification_system TO admin;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL initialization completed successfully';
    RAISE NOTICE 'Database: notification_system';
    RAISE NOTICE 'User: admin';
    RAISE NOTICE 'Ready for Prisma migrations';
END $$;
