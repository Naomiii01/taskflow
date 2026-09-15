create type taskflow.work_shift_enum as enum ('早班', '中班', '大夜班');

alter table taskflow.aircraft_ground_windows
  add column shift taskflow.work_shift_enum null;

comment on column taskflow.aircraft_ground_windows.shift is '計畫大工的班別（早班/中班/大夜班）——只在有安排大工項目時才有意義，純過夜停留不需要填。';

notify pgrst, 'reload schema';
