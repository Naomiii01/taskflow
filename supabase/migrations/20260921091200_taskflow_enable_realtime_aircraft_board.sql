-- Aircraft Planning Board 即時同步：讓地停時間／駐廠輪替／部門標示的異動
-- 能透過 Supabase Realtime 直接推播到前端（機隊看板是登入後預設首頁，
-- 別人一有改動應該幾乎立刻反映，不用等輪詢或手動重新整理）。
-- notifications 資料表先前已經加入 supabase_realtime publication；這裡補上
-- 機隊看板實際會變動的三張表。
ALTER PUBLICATION supabase_realtime ADD TABLE taskflow.aircraft_ground_windows;
ALTER PUBLICATION supabase_realtime ADD TABLE taskflow.aircraft_residency_windows;
ALTER PUBLICATION supabase_realtime ADD TABLE taskflow.aircraft_department_windows;
