-- OpenCall upgrade. Apply after schema.sql when deploying this local feature.
-- Public pages use the FastAPI projection; voter hashes and notes stay private.
create table if not exists public.opencalls (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null unique references public.briefs(id),
  owner_id uuid not null references public.users(id),
  state jsonb not null,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now()
);
create index if not exists opencalls_owner_id_idx on public.opencalls(owner_id);
alter table public.opencalls enable row level security;
revoke all on public.opencalls from public, anon, authenticated;
grant select, insert, update, delete on public.opencalls to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('crevo-opencall','crevo-opencall',false,52428800,array['image/png','image/jpeg','image/webp','video/mp4'])
on conflict(id) do nothing;

create or replace function public.select_opencall_winner(
 p_call_id uuid,p_owner_id uuid,p_revision integer,p_entry_id text,p_state jsonb
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.opencalls%rowtype; b public.briefs%rowtype; e jsonb;
 a public.applications%rowtype; result jsonb; saved jsonb;
begin
 select * into c from public.opencalls where id=p_call_id for update;
 if not found or c.owner_id is distinct from p_owner_id then raise exception 'OpenCall not found'; end if;
 if c.state->>'status'='selected' and c.state->>'winner_id'=p_entry_id then return c.state; end if;
 if c.revision<>p_revision or c.state->>'status' in ('selected','cancelled') then raise exception 'OpenCall changed'; end if;
 select * into b from public.briefs where id=c.brief_id for update;
 if b.archived_at is not null then raise exception 'Brief unavailable'; end if;
 if exists(select 1 from public.projects where brief_id=c.brief_id) then raise exception 'Project already exists'; end if;
 select value into e from jsonb_array_elements(c.state->'entries') where value->>'id'=p_entry_id and value->>'status'='submitted';
 if e is null or p_state->>'winner_id' is distinct from p_entry_id or p_state->>'status'<>'selected' then raise exception 'Invalid winner'; end if;
 if not exists(select 1 from public.creators cr join public.users u on u.id=cr.owner_id
   where cr.id=(e->>'creator_id')::uuid and cr.archived_at is null and u.disabled_at is null) then raise exception 'Creator unavailable'; end if;
 select * into a from public.applications where brief_id=c.brief_id and creator_id=(e->>'creator_id')::uuid for update;
 if not found then
  insert into public.applications(brief_id,creator_id,note,status)
  values(c.brief_id,(e->>'creator_id')::uuid,'Selected through OpenCall: '||(e->>'title'),'pending') returning * into a;
 elsif a.status<>'pending' then raise exception 'Application already decided'; end if;
 result := public.transition_application(a.id,p_owner_id,'accepted');
 update public.projects set workflow=workflow||jsonb_build_object('opencall',jsonb_build_object(
  'id',c.id,'entry_id',p_entry_id,'title',e->>'title','preview_url',e->'media'->>'url')) where id=(result->>'id')::uuid;
 saved := p_state||jsonb_build_object('project_id',result->>'id');
 update public.opencalls set state=saved,revision=revision+1 where id=c.id;
 update public.briefs set status='closed' where id=c.brief_id;
 return saved;
end $$;
revoke all on function public.select_opencall_winner(uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.select_opencall_winner(uuid,uuid,integer,text,jsonb) to service_role;
