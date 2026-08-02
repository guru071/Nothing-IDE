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
