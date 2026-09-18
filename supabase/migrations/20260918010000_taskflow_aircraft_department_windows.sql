-- 機坪維修部 vs 基地維修部——哪架飛機現在在哪個部門手上。
--
-- 來源是年度維修計畫表（STARLUX Yearly Maintenance Schedule PDF）：小格子（單日
-- 或幾天，標示 3 碼機號）＝機坪部門在接送機LINE上作業；其餘不管顏色（黃/橘/綠/
-- 灰）的寬條（通常是 48MO/C01/C02/結構維修/WIFI MOD/AD 等長天期重工）＝基地部
-- 門執行的長天期地停維修。這是額外疊加在 aircraft_ground_windows（每日地停）和
-- aircraft_residency_windows（駐廠輪替）之上的第三種資訊，互不取代。
--
-- 跟 aircraft_residency_windows 的 [start_date, end_date) 半開區間不同，這裡
-- end_date 是「含當天」（inclusive）——比較符合維修計畫表本身「幾號到幾號」的
-- 填法，也是從 PDF 讀出來時最自然的表示方式。
create table taskflow.aircraft_department_windows (
  id uuid primary key default gen_random_uuid(),
  aircraft_registration text not null references taskflow.fleet_master(aircraft_registration),
  department text not null check (department = any (array['機坪', '基地'])),
  start_date date not null,
  end_date date not null,
  -- 該筆工作的說明文字，原樣保留 PDF 上的標籤（例如「48MO(1434天98.22%)+WIFI MOD+ENG RBS MOD」）；
  -- 機坪的小格子在 PDF 上通常只有機號、沒有文字說明，這裡就是 null。
  description text,
  source text not null default 'manual' check (source = any (array['manual', 'import'])),
  -- 匯入來源文件名稱／版本，方便日後追查這筆資料是哪一份年度計畫表匯入的。
  source_document text,
  notes text,
  created_by uuid references taskflow.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aircraft_department_windows_date_order check (end_date >= start_date)
);

comment on table taskflow.aircraft_department_windows is '機坪維修部／基地維修部——哪架飛機現在在哪個部門手上，來源通常是年度維修計畫表匯入。跟 aircraft_ground_windows／aircraft_residency_windows 是分開、疊加顯示的第三種資訊。';
comment on column taskflow.aircraft_department_windows.end_date is '結束日——含當天（inclusive），跟 aircraft_residency_windows 的半開區間不同，請注意。';

create index aircraft_department_windows_lookup_idx
  on taskflow.aircraft_department_windows (aircraft_registration, start_date, end_date);

alter table taskflow.aircraft_department_windows enable row level security;

create policy "authenticated can view aircraft_department_windows"
  on taskflow.aircraft_department_windows for select
  using (true);

create policy "authenticated can insert aircraft_department_windows"
  on taskflow.aircraft_department_windows for insert
  with check (true);

create policy "authenticated can update aircraft_department_windows"
  on taskflow.aircraft_department_windows for update
  using (true)
  with check (true);

create policy "admins can delete aircraft_department_windows"
  on taskflow.aircraft_department_windows for delete
  using (taskflow.is_admin());

create trigger aircraft_department_windows_set_updated_at
  before update on taskflow.aircraft_department_windows
  for each row execute function taskflow.set_updated_at();

notify pgrst, 'reload schema';
