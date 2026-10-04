-- Trade Vision 每周候選池：candidate_pool 表
-- 在 Supabase Dashboard → SQL Editor 執行一次即可。
-- 讀寫都走 service role key（server-side），開啟 RLS 不另設 policy。

create table if not exists candidate_pool (
  symbol text primary key,
  name text not null,
  sector text,
  rank int not null,
  avg_dollar_vol_m numeric,
  updated_at timestamptz not null default now()
);

alter table candidate_pool enable row level security;
