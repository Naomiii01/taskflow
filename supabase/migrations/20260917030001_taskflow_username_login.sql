-- 登入帳號改為「帳號」（Email 的 @ 前半段），不需要輸入完整 Email。
-- 因為 taskflow.users 的 SELECT RLS 只開放給 authenticated（尚未登入的人讀不到），
-- 所以用 security definer function 讓匿名的登入請求也能把「帳號」解析成真正的 Email，
-- 再拿這個 Email 去呼叫 signInWithPassword。

create or replace function taskflow.resolve_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = taskflow, public
as $$
  select email from taskflow.users
  where lower(split_part(email, '@', 1)) = lower(p_username)
  limit 1;
$$;

grant execute on function taskflow.resolve_login_email(text) to anon, authenticated;
