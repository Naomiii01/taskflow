-- ============================================================================
-- AI 工作追蹤與跨部門協作系統 V1
-- Migration 3/3: seed data
--
-- Seeds departments and demo tasks so Dashboard/Kanban have real numbers to
-- show immediately. Tasks are left unassigned (owner_id = null) because
-- auth.users accounts don't exist yet -- after you sign up, use the
-- "Reassign demo tasks to me" snippet in README.md to claim them.
-- ============================================================================

insert into taskflow.departments (department_name) values
  ('業務部'),
  ('客服部'),
  ('行銷部'),
  ('教練培訓部'),
  ('財務部')
on conflict (department_name) do nothing;

with d as (
  select id, department_name from taskflow.departments
)
insert into taskflow.tasks (title, description, priority, status, due_date, followup_date, department_id, created_at)
select t.title, t.description, t.priority, t.status, t.due_date, t.followup_date, d.id, t.created_at
from (values
  ('跟進台北信義區夥伴招募進度', '追蹤上週說明會後的 5 位潛在夥伴，確認是否已完成資料填寫。', 'P1'::taskflow.task_priority, 'In Progress'::taskflow.task_status, current_date, current_date, '業務部', now() - interval '4 days'),
  ('回覆客戶 LINE 諮詢（減脂課程）', '客戶詢問三個月減脂課程方案與價格，需附上比較表。', 'P2'::taskflow.task_priority, 'Waiting Response'::taskflow.task_status, current_date, current_date, '客服部', now() - interval '2 days'),
  ('準備 9 月教練培訓教材', '更新營養學與體態評估章節投影片。', 'P2'::taskflow.task_priority, 'Todo'::taskflow.task_status, current_date + 3, current_date + 3, '教練培訓部', now() - interval '1 days'),
  ('審核夥伴晉升申請（3件）', '審核三位夥伴的晉升資格文件並簽核。', 'P1'::taskflow.task_priority, 'Pending Approval'::taskflow.task_status, current_date + 1, current_date + 1, '業務部', now() - interval '6 hours'),
  ('社群貼文企劃 - 中秋節活動', '規劃中秋節限定體驗課程貼文與素材。', 'P3'::taskflow.task_priority, 'Todo'::taskflow.task_status, current_date + 5, null, '行銷部', now() - interval '3 days'),
  ('對帳：8 月夥伴分潤明細', '核對 8 月分潤金額並產出報表給財務部。', 'P1'::taskflow.task_priority, 'In Progress'::taskflow.task_status, current_date - 1, current_date - 1, '財務部', now() - interval '5 days'),
  ('客戶投訴處理 - 課程時段調整', '客戶反映排課時段衝突，需協調教練與場地。', 'P1'::taskflow.task_priority, 'Waiting Response'::taskflow.task_status, current_date - 2, current_date - 2, '客服部', now() - interval '7 days'),
  ('新夥伴 Onboarding 資料包更新', '更新新夥伴入職手冊，加入最新品牌規範。', 'P3'::taskflow.task_priority, 'Todo'::taskflow.task_status, current_date + 10, null, '教練培訓部', now() - interval '2 days'),
  ('7 月業績報表整理', '彙整 7 月各夥伴業績並提交主管審閱。', 'P2'::taskflow.task_priority, 'Completed'::taskflow.task_status, current_date - 20, null, '業務部', now() - interval '25 days'),
  ('官網課程頁面文案優化', '重寫官網三個主力課程的介紹文案。', 'P4'::taskflow.task_priority, 'Todo'::taskflow.task_status, current_date + 14, null, '行銷部', now() - interval '1 days'),
  ('季度教練考核作業', '完成本季 12 位教練的考核評分表。', 'P2'::taskflow.task_priority, 'In Progress'::taskflow.task_status, current_date - 4, current_date - 4, '教練培訓部', now() - interval '10 days'),
  ('財務系統帳號權限盤點', '盤點財務系統目前開通的帳號與權限是否合規。', 'P3'::taskflow.task_priority, 'Cancelled'::taskflow.task_status, current_date - 10, null, '財務部', now() - interval '15 days'),
  ('客訴案件 - 退費申請審核', '審核一件退費申請並確認退款流程。', 'P1'::taskflow.task_priority, 'Completed'::taskflow.task_status, current_date - 1, null, '客服部', now() - interval '3 days'),
  ('8 月新夥伴數量統計與分析', '統計 8 月各部門新增夥伴數並產出簡報。', 'P2'::taskflow.task_priority, 'Completed'::taskflow.task_status, current_date - 6, null, '業務部', now() - interval '9 days'),
  ('IG 廣告成效週報', '整理本週 IG 廣告投放成效與建議。', 'P3'::taskflow.task_priority, 'In Progress'::taskflow.task_status, current_date, current_date, '行銷部', now() - interval '12 hours')
) as t(title, description, priority, status, due_date, followup_date, department_name, created_at)
join d on d.department_name = t.department_name;

-- A couple of follow-up records + one AI summary for realism.
insert into taskflow.followups (task_id, followup_date, department_name, content, result, next_action)
select id, current_date, '客服部', '已致電客戶說明時段調整方案。', '客戶考慮中，明日回覆。', '明日 10:00 前致電確認結果'
from taskflow.tasks where title = '客戶投訴處理 - 課程時段調整';

insert into taskflow.ai_summaries (task_id, summary, key_points, next_actions)
select id,
  '客戶對課程時段調整表達不滿，主因為原時段與新課表衝突，客服已提出兩個替代方案，客戶仍在考慮中。',
  '["原時段與 9 月新課表衝突", "已提供兩個替代時段方案", "客戶尚未回覆確認"]'::jsonb,
  '["明日 10:00 前致電確認客戶決定", "若無法達成共識，upgrade 至客服主管處理"]'::jsonb
from taskflow.tasks where title = '客戶投訴處理 - 課程時段調整';
