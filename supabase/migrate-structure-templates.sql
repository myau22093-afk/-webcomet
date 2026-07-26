-- Structure layouts for cheap wizard adapt (seed HTML may live in code; DB for overrides)
create table if not exists public.structure_templates (
  id text primary key,
  label text not null,
  description text,
  html text not null,
  css text not null,
  js text not null default '',
  created_by_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.structure_templates is
  'Layout skeletons: Fable-quality structure, adapted at runtime by cheaper models';
