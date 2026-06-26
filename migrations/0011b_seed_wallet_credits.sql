-- Seed initial credits for test/demo users
-- This script initializes wallet accounts for existing users with 100 credits each
-- for safe testing of the metering system

-- Initialize wallet account for mikebjork (the default seeded user)
INSERT INTO wallet_accounts (user_id, balance_credits)
SELECT id, 100
FROM users
WHERE username = 'mikebjork' AND id NOT IN (SELECT user_id FROM wallet_accounts)
ON CONFLICT (user_id) DO NOTHING;

-- Initialize wallet account for all other users with 100 credits
INSERT INTO wallet_accounts (user_id, balance_credits)
SELECT id, 100
FROM users
WHERE id NOT IN (SELECT user_id FROM wallet_accounts)
ON CONFLICT (user_id) DO NOTHING;

-- Record the seeding as ledger entries
INSERT INTO wallet_ledger (user_id, delta_credits, balance_after, reason, created_at)
SELECT 
  wa.user_id,
  100,
  100,
  'system:initial_allocation',
  now()
FROM wallet_accounts wa
WHERE NOT EXISTS (
  SELECT 1 FROM wallet_ledger wl WHERE wl.user_id = wa.user_id
)
ON CONFLICT DO NOTHING;
