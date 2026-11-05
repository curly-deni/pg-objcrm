create index tasks_created_by_idx on public.tasks (created_by);

create index task_history_actor_created_idx on public.task_status_history (actor_id, created_at);
