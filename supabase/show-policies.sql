-- Run this in the SQL Editor for the "both policies" screenshot.

select
  tablename,
  policyname,
  cmd,
  roles,
  qual       as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename;

-- And confirm RLS is switched on for both tables (rowsecurity = true):
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
