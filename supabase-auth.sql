-- Trade Vision 登入與系統管理：app_users / app_config 表
-- 在 Supabase Dashboard → SQL Editor 執行一次即可。
-- 讀寫都走 service role key（server-side），開啟 RLS 不另設 policy。

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_users enable row level security;
alter table app_config enable row level security;
