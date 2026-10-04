-- Trade Vision 每周候選池歷史：pool_history 表（週報用）
-- 在 Supabase Dashboard → SQL Editor 執行一次即可。
-- 讀寫都走 service role key（server-side），開啟 RLS 不另設 policy。

create table if not exists pool_history (
  week_start date not null,
  symbol text not null,
  name text not null,
  sector text,
  rank int not null,
  avg_dollar_vol_m numeric,
  created_at timestamptz not null default now(),
  primary key (week_start, symbol)
);

alter table pool_history enable row level security;
