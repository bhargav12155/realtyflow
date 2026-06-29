CREATE TABLE IF NOT EXISTS wallet_accounts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL UNIQUE,
  balance_credits integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user
  ON wallet_accounts (user_id);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  delta_credits integer NOT NULL,
  balance_after integer NOT NULL,
  reason text NOT NULL,
  request_id text,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created
  ON wallet_ledger (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_request
  ON wallet_ledger (request_id);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  provider text NOT NULL,
  feature text NOT NULL,
  status text NOT NULL,
  estimated_credits integer,
  actual_credits integer,
  request_id text,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_created
  ON ai_usage_events (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_provider
  ON ai_usage_events (provider);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_request
  ON ai_usage_events (request_id);
