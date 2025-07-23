-- Initialize PostgreSQL database for CodeMentor AI
-- This script runs when the container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create database user for application (if needed)
-- The main database and user are created via environment variables

-- Set timezone
SET timezone = 'UTC';