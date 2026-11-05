create type public.app_role as enum('manager', 'executor');

create type public.task_status as enum(
  'new',
  'in_progress',
  'in_review',
  'accepted',
  'rework'
);

create schema private;

revoke all on schema private
from
  public,
  anon,
  authenticated;

grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120),
  role public.app_role not null
);

create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  address text not null check (length(btrim(address)) between 1 and 300),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (
    description is null
    or length(description) <= 5000
  ),
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict default auth.uid (),
  status public.task_status not null default 'new',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  old_status public.task_status,
  new_status public.task_status not null,
  comment text check (
    comment is null
    or length(comment) <= 2000
  ),
  created_at timestamptz not null default now()
);

create index tasks_object_active_idx on public.tasks (object_id)
where
  deleted_at is null;

create index tasks_assignee_active_idx on public.tasks (assignee_id, status)
where
  deleted_at is null;

create index task_history_task_created_idx on public.task_status_history (task_id, created_at);

create function private.current_role () returns public.app_role language sql stable security definer
set
  search_path = '' as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid());
$$;

create function private.is_manager () returns boolean language sql stable security definer
set
  search_path = '' as $$
  select coalesce((select private.current_role()) = 'manager', false);
$$;

create function private.can_read_task (p_task_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.tasks as t
    where t.id = p_task_id
      and (
        (select private.current_role()) = 'manager'
        or (t.deleted_at is null and t.assignee_id = (select auth.uid()))
      )
  );
$$;

revoke all on function private.current_role ()
from
  public,
  anon;

revoke all on function private.is_manager ()
from
  public,
  anon;

revoke all on function private.can_read_task (uuid)
from
  public,
  anon;

grant
execute on function private.current_role () to authenticated;

grant
execute on function private.is_manager () to authenticated;

grant
execute on function private.can_read_task (uuid) to authenticated;

create function private.set_task_author_and_check () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  object_is_active boolean;
begin
  if (select auth.uid()) is null or not (select private.is_manager()) then
    raise insufficient_privilege using message = 'Only a manager can create tasks';
  end if;

  new.created_by := (select auth.uid());
  new.status := 'new';

  select o.deleted_at is null into object_is_active
  from public.objects as o
  where o.id = new.object_id
  for share;

  if not found or not object_is_active then
    raise foreign_key_violation using message = 'The object does not exist or is archived';
  end if;

  if (select private.current_role()) is null then
    raise insufficient_privilege using message = 'A profile is required';
  end if;

  if not exists (
    select 1 from public.profiles as p
    where p.id = new.assignee_id and p.role = 'executor'
  ) then
    raise check_violation using message = 'The assignee must be an executor';
  end if;

  return new;
end;
$$;

create function private.check_task_update () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if new.object_id is distinct from old.object_id
    or new.created_by is distinct from old.created_by
  then
    raise insufficient_privilege using message = 'Use the authorized task RPC for protected fields';
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    if not (select private.is_manager()) or old.status not in ('new', 'rework') then
      raise insufficient_privilege using message = 'Tasks can only be reassigned in new or rework status';
    end if;

    if not exists (
      select 1 from public.profiles as p
      where p.id = new.assignee_id and p.role = 'executor'
    ) then
      raise check_violation using message = 'The assignee must be an executor';
    end if;
  end if;

  return new;
end;
$$;

create function private.record_task_creation () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  insert into public.task_status_history (task_id, actor_id, old_status, new_status)
  values (new.id, new.created_by, null, 'new');
  return new;
end;
$$;

revoke all on function private.set_task_author_and_check ()
from
  public,
  anon,
  authenticated;

revoke all on function private.check_task_update ()
from
  public,
  anon,
  authenticated;

revoke all on function private.record_task_creation ()
from
  public,
  anon,
  authenticated;

create trigger tasks_author_and_check
before insert on public.tasks for each row
execute function private.set_task_author_and_check ();

create trigger tasks_check_update
before update on public.tasks for each row
execute function private.check_task_update ();

create trigger tasks_record_creation
after insert on public.tasks for each row
execute function private.record_task_creation ();

alter table public.profiles enable row level security;

alter table public.objects enable row level security;

alter table public.tasks enable row level security;

alter table public.task_status_history enable row level security;

create policy profiles_read_allowed on public.profiles for
select
  to authenticated using (
    id = (
      select
        auth.uid ()
    )
    or (
      (
        select
          private.is_manager ()
      )
      and role = 'executor'
    )
  );

create policy objects_read_allowed on public.objects for
select
  to authenticated using (
    deleted_at is null
    and (
      (
        select
          private.is_manager ()
      )
      or exists (
        select
          1
        from
          public.tasks as t
        where
          t.object_id = objects.id
          and t.assignee_id = (
            select
              auth.uid ()
          )
          and t.deleted_at is null
      )
    )
  );

create policy objects_insert_manager on public.objects for insert to authenticated
with
  check (
    (
      select
        private.is_manager ()
    )
  );

create policy objects_update_manager on public.objects
for update
  to authenticated using (
    deleted_at is null
    and (
      select
        private.is_manager ()
    )
  )
with
  check (
    deleted_at is null
    and (
      select
        private.is_manager ()
    )
  );

create policy tasks_read_allowed on public.tasks for
select
  to authenticated using (
    (
      select
        private.is_manager ()
    )
    or (
      deleted_at is null
      and assignee_id = (
        select
          auth.uid ()
      )
    )
  );

create policy tasks_insert_manager on public.tasks for insert to authenticated
with
  check (
    (
      select
        private.is_manager ()
    )
    and created_by = (
      select
        auth.uid ()
    )
    and status = 'new'
  );

create policy tasks_update_manager on public.tasks
for update
  to authenticated using (
    deleted_at is null
    and (
      select
        private.is_manager ()
    )
  )
with
  check (
    deleted_at is null
    and (
      select
        private.is_manager ()
    )
  );

create policy task_history_read_allowed on public.task_status_history for
select
  to authenticated using (
    (
      select
        private.can_read_task (task_id)
    )
  );

revoke all on public.profiles,
public.objects,
public.tasks,
public.task_status_history
from
  public,
  anon,
  authenticated;

grant
select
  on public.profiles to authenticated;

grant
select
  on public.objects to authenticated;

grant insert (name, address) on public.objects to authenticated;

grant
update (name, address) on public.objects to authenticated;

grant
select
  on public.tasks to authenticated;

grant insert (object_id, title, description, assignee_id) on public.tasks to authenticated;

grant
update (title, description, assignee_id) on public.tasks to authenticated;

grant
select
  on public.task_status_history to authenticated;

create function public.transition_task (
  p_task_id uuid,
  p_new_status public.task_status,
  p_comment text default null
) returns public.tasks language plpgsql security definer
set
  search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  actor_role public.app_role;
  task_row public.tasks;
  old_task_status public.task_status;
  transition_allowed boolean := false;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Sign in to change task status';
  end if;

  select p.role into actor_role
  from public.profiles as p
  where p.id = current_user_id;

  select t.* into task_row
  from public.tasks as t
  where t.id = p_task_id and t.deleted_at is null
  for update;

  if not found then
    raise no_data_found using message = 'Task not found';
  end if;

  old_task_status := task_row.status;

  if p_new_status = 'in_progress' and task_row.status in ('new', 'rework')
    and actor_role = 'executor' and task_row.assignee_id = current_user_id then
    transition_allowed := true;
  elsif p_new_status = 'in_review' and task_row.status = 'in_progress'
    and actor_role = 'executor' and task_row.assignee_id = current_user_id then
    transition_allowed := true;
  elsif p_new_status = 'accepted' and task_row.status = 'in_review'
    and actor_role = 'manager' then
    transition_allowed := true;
  elsif p_new_status = 'rework' and task_row.status = 'in_review'
    and actor_role = 'manager' then
    transition_allowed := true;
    if p_comment is null or length(btrim(p_comment)) = 0 then
      raise check_violation using message = 'A comment is required when returning a task to rework';
    end if;
  end if;

  if actor_role is null or not transition_allowed then
    raise check_violation using message = 'This user cannot make the requested status transition';
  end if;

  if p_comment is not null and length(p_comment) > 2000 then
    raise check_violation using message = 'Comment is too long';
  end if;

  update public.tasks as t
  set status = p_new_status
  where t.id = p_task_id
  returning t.* into task_row;

  insert into public.task_status_history (task_id, actor_id, old_status, new_status, comment)
  values (task_row.id, current_user_id, old_task_status, p_new_status, p_comment);

  return task_row;
end;
$$;

create function public.archive_task (p_task_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  if (select auth.uid()) is null or not (select private.is_manager()) then
    raise insufficient_privilege using message = 'Only a manager can archive tasks';
  end if;

  update public.tasks as t
  set deleted_at = now()
  where t.id = p_task_id and t.deleted_at is null;

  if not found then
    raise no_data_found using message = 'Active task not found';
  end if;
end;
$$;

create function public.archive_object (p_object_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
begin
  if (select auth.uid()) is null or not (select private.is_manager()) then
    raise insufficient_privilege using message = 'Only a manager can archive objects';
  end if;

  perform 1
  from public.objects as o
  where o.id = p_object_id and o.deleted_at is null
  for update;

  if not found then
    raise no_data_found using message = 'Active object not found';
  end if;

  if exists (
    select 1 from public.tasks as t
    where t.object_id = p_object_id and t.deleted_at is null
  ) then
    raise foreign_key_violation using message = 'Archive or remove active tasks before archiving the object';
  end if;

  update public.objects as o
  set deleted_at = now()
  where o.id = p_object_id;
end;
$$;

revoke all on function public.transition_task (uuid, public.task_status, text)
from
  public,
  anon;

revoke all on function public.archive_task (uuid)
from
  public,
  anon;

revoke all on function public.archive_object (uuid)
from
  public,
  anon;

grant
execute on function public.transition_task (uuid, public.task_status, text) to authenticated;

grant
execute on function public.archive_task (uuid) to authenticated;

grant
execute on function public.archive_object (uuid) to authenticated;
