drop policy if exists grant_questions_delete_exec on public.grant_questions;

create policy grant_questions_delete on public.grant_questions
  for delete using (org_id = public.current_org_id());
