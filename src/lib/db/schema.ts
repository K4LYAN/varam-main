/** Idempotent schema. Runs once per server instance on first database access. */
export const SCHEMA_SQL: string[] = [
  `create table if not exists categories (
    id text primary key,
    slug text not null unique,
    name text not null,
    description text not null default '',
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists products (
    id text primary key,
    slug text not null unique,
    name text not null,
    category_id text references categories(id) on delete set null,
    short_description text not null default '',
    description text not null default '',
    ingredients text not null default '',
    extraction_process text not null default '',
    storage text not null default '',
    specifications jsonb not null default '[]'::jsonb,
    images jsonb not null default '[]'::jsonb,
    variants jsonb not null default '[]'::jsonb,
    oil_tone text not null default '#D9A93B',
    featured boolean not null default false,
    is_new boolean not null default false,
    available boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists products_category_idx on products(category_id)`,
  `alter table products add column if not exists uses text not null default ''`,
  `create table if not exists testimonials (
    id text primary key,
    name text not null,
    location text not null default '',
    quote text not null,
    published boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
  )`,
  `alter table testimonials add column if not exists rating integer not null default 5`,
  `alter table testimonials add column if not exists source text not null default 'customer'`,
  `alter table testimonials add column if not exists review_date text not null default ''`,
];
