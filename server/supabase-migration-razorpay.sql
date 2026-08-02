-- Incremental migration for native Razorpay checkout support. Run this once
-- in the Supabase SQL editor - safe even if you already ran the base
-- supabase-schema.sql earlier (every statement here is a no-op if its
-- column/table already exists, unlike "create policy" which errors on a
-- second run).

alter table purchases add column if not exists razorpay_order_id text;
alter table purchases add column if not exists razorpay_payment_id text;

-- Tracks a Razorpay order from creation until its payment is verified, so
-- POST /api/plugin/razorpay/verify can confirm the signature belongs to the
-- *same user and plugin* that requested it - a signature alone only proves
-- the order/payment pair is genuine, not who is allowed to claim it. Rows
-- are deleted the moment they're consumed (see pluginsRepo.consumePendingRazorpayOrder),
-- so a leftover row also means "not yet paid for".
create table if not exists razorpay_orders (
	order_id text primary key,
	user_id uuid not null references auth.users(id) on delete cascade,
	plugin_id text not null references plugins(id) on delete cascade,
	amount numeric not null,
	currency text not null default 'inr',
	created_at timestamptz not null default now()
);

-- Only ever touched by the server's service-role client, never the app/browser
-- directly - RLS with no policies means "service role only", which is exactly
-- what we want here (no public read/write access at all).
alter table razorpay_orders enable row level security;
