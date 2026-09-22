-- 班別從「早班／中班／大夜班」改成實際排班代碼＋時段：
-- 05H(05:00-13:00)、12H(12:00-20:30)、15H(15:00-23:30)、17H(17:00-01:30+1)、
-- 20U(20:30-05:00+1)、23H(23:00-07:30+1)。
-- 目前只有 3 筆測試資料用到舊值（早班/中班/大夜班各一筆），先清空，
-- 沒有其他資料需要搬移。
UPDATE taskflow.aircraft_ground_windows SET shift = NULL WHERE shift IS NOT NULL;

ALTER TYPE taskflow.work_shift_enum RENAME TO work_shift_enum_old;

CREATE TYPE taskflow.work_shift_enum AS ENUM ('05H', '12H', '15H', '17H', '20U', '23H');

ALTER TABLE taskflow.aircraft_ground_windows
  ALTER COLUMN shift TYPE taskflow.work_shift_enum
  USING NULL::taskflow.work_shift_enum;

DROP TYPE taskflow.work_shift_enum_old;
