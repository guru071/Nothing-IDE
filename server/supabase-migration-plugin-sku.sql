-- Incremental migration: adds the sku column to an existing plugins table
-- that predates it (created before Play Billing support was added, so the
-- "create table if not exists" in supabase-schema.sql silently skipped it -
-- same reason purchases/razorpay_orders needed their own incremental
-- migration earlier). Safe to run regardless of current state.

alter table plugins add column if not exists sku text;
