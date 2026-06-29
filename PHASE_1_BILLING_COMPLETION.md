# Phase 1 Billing System - Completion Guide

## What's Been Implemented

### 1. Admin Billing Routes (NEW)
**File:** `server/routes/admin-billing.ts`

Three new admin endpoints for credit management:

- **GET /api/admin/billing/wallet/:userId** — View user's wallet balance and recent ledger entries
- **POST /api/admin/billing/topup** — Add credits to a user's account
  ```json
  {
    "userId": "user_id_here",
    "amountCredits": 100,
    "reason": "test allocation"
  }
  ```
  Response: `{ success: true, userId, creditsAdded, newBalance, reason }`

- **GET /api/admin/billing/usage** — View recent AI usage events (100 max, configurable with ?limit param)
  Returns summary of charged/refunded/blocked events grouped by provider

### 2. Database Migration
**File:** `migrations/0011_add_wallet_and_ai_usage.sql`
Creates three new tables with indexes:
- `wallet_accounts` (user_id, balance_credits)
- `wallet_ledger` (immutable audit log of all credits debit/credit)
- `ai_usage_events` (usage tracking for providers, features, and status)

### 3. Initial Credit Seeding Script
**File:** `migrations/0011b_seed_wallet_credits.sql`
Seeds 100 credits to all users (including mikebjork)

### 4. Routes Integration
Updated `server/routes.ts` to register the new admin billing routes

---

## Execution Steps (In Order)

### Step 1: Run Database Migration
```bash
npm run db:push
```
This will apply the new wallet schema to your database.

### Step 2: Seed Initial Credits
Choose ONE of these approaches:

**Option A: Direct SQL Execution** (if you have psql access)
```bash
psql -U postgres -d realtyflow < migrations/0011b_seed_wallet_credits.sql
```

**Option B: Via Admin Endpoint** (recommended - once db:push completes)
```bash
# For each test user you want to initialize, call the top-up endpoint
# Example: Add 100 credits to mikebjork
curl -X POST http://localhost:5000/api/admin/billing/topup \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "userId": "user_id_of_mikebjork",
    "amountCredits": 100,
    "reason": "initial allocation"
  }'
```

**Option C: Create a POST /admin/billing/seed endpoint** (I can add if you prefer)

### Step 3: Verify Everything Works

Check wallet balance:
```bash
curl http://localhost:5000/api/admin/billing/wallet/user_id_here \
  -H "Cookie: session=..."
```

Check usage events:
```bash
curl http://localhost:5000/api/admin/billing/usage \
  -H "Cookie: session=..."
```

---

## What This Enables

✅ Users with brainstorm chat → 1 credit (or 2 with images)
✅ Users with Luma video gen → 6-10 credits per video
✅ Blocked requests if insufficient credits (402 status)
✅ Automatic refunds on generation failure
✅ Admin ability to top-up credits for testing
✅ Audit trail of all credit movements
✅ Usage metrics for billing/analytics

---

## Next Steps: Phase 2 (Stripe Integration)

When ready, we'll add:
1. Stripe price/pack configuration (5 packs with different credit amounts)
2. POST /api/billing/checkout — create Stripe checkout sessions
3. POST /api/webhooks/stripe — webhook handler for payment.intent.succeeded
4. Credit grant logic after successful payment
5. Processed webhook deduplication table

For now, admin top-ups let you test the full metering flow without Stripe.

---

## Architecture Summary

**Credit Flow:**
1. User initiates brainstorm chat or video generation
2. `chargeCredits()` deducts from wallet (atomic, fails if insufficient)
3. Provider call executes
4. If success → ledger records "charged" status
5. If failure → `refundCredits()` restores credits, records "refunded" status
6. Client gets 402 + `{ requiredCredits, balanceCredits }` if not enough

**Data Consistency:**
- All operations are database transactions (atomic)
- Ledger is immutable (audit trail)
- Usage events log both provider cost and final outcome
- Balance guards prevent overdrafts (gte check in WHERE clause)

---

## Files Changed/Added

- ✅ `server/routes/admin-billing.ts` (NEW)
- ✅ `server/routes.ts` (updated registration)
- ✅ `migrations/0011_add_wallet_and_ai_usage.sql` (NEW - from earlier)
- ✅ `migrations/0011b_seed_wallet_credits.sql` (NEW)
- ✅ `server/services/usage-metering.ts` (NEW - from earlier)
- ✅ `server/storage.ts` (updated wallet methods - from earlier)
- ✅ `shared/schema.ts` (updated wallet schemas - from earlier)
- ✅ `server/routes/boards-chat.ts` (integrated charging/refunding - from earlier)

---

## Troubleshooting

**Error: "walletLedger not found"**
→ Make sure `npm run db:push` completed successfully

**Error: 402 Insufficient Credits on first request**
→ Run the seeding script (0011b) or call the top-up endpoint

**Error: Unknown route /api/admin/billing/...**
→ Make sure server restarted after routes.ts update

**Need to check current balance?**
```bash
curl http://localhost:5000/api/billing/credits -H "Cookie: session=..."
```
This returns: `{ balanceCredits: 100 }`
