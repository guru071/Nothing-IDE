-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- for a fresh project, before the server points at it.

create table if not exists plugins (
	id text primary key,
	name text not null,
	description text not null default '',
	author text not null default 'Nothing IDE',
	author_verified boolean not null default true,
	license text not null default 'MIT',
	version text not null default '1.0.0',
	keywords text[] not null default '{}',
	changelogs text not null default '',
	supported_editor text not null default 'cm',
	price numeric not null default 0,
	currency_symbol text not null default '$',
	-- Google Play in-app product ID for this plugin (must already exist as a
	-- one-time product in the Play Console for the app - required for any
	-- plugin with a non-zero price, unused for free ones).
	sku text,
	downloads integer not null default 0,
	icon_path text not null,
	file_path text not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- The server always talks to Supabase with the service role key (server-side
-- only, never shipped to the app or browser), which bypasses RLS entirely.
-- Enabling RLS here is just defense in depth in case the anon key is ever
-- exposed to a client directly - it still only allows public read access.
alter table plugins enable row level security;

create policy "Public read access" on plugins
	for select
	using (true);

-- Atomic download counter bump, called by GET /api/plugin/download/:id.
create or replace function increment_plugin_downloads(plugin_id text)
returns void
language sql
as $$
	update plugins set downloads = downloads + 1 where id = plugin_id;
$$;

-- Storage: create one bucket named "plugin-assets", set to PUBLIC, with two
-- folders inside it: "icons/" and "downloads/". Easiest done from the
-- dashboard: Storage -> New bucket -> name "plugin-assets" -> check
-- "Public bucket" -> Create. The folders are created automatically on first
-- upload, nothing to do for them ahead of time.

-- Accounts (Supabase Auth) + paid plugins. auth.users already exists once
-- Auth is enabled in the dashboard - this just records what each signed-in
-- user has bought, one row per (user, plugin).
create table if not exists purchases (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	plugin_id text not null references plugins(id) on delete cascade,
	play_purchase_token text,
	play_order_id text,
	-- Populated instead of the play_* columns above when bought through the
	-- native Razorpay checkout (the path used when the app isn't installed
	-- from Play Store, so Play Billing isn't available).
	razorpay_order_id text,
	razorpay_payment_id text,
	amount numeric not null default 0,
	currency text not null default 'usd',
	created_at timestamptz not null default now(),
	unique (user_id, plugin_id)
);

alter table purchases enable row level security;

-- The server always writes/reads this with the service role key (bypasses
-- RLS), same as `plugins` above - this policy is defense in depth in case
-- the publishable/anon key is ever used to query it directly from the app:
-- a user can only ever see their own purchases, never anyone else's.
create policy "Users can read their own purchases" on purchases
	for select
	using (auth.uid() = user_id);

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
