-- Add subscription and plan fields to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'STARTER',
ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS renewal_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');
