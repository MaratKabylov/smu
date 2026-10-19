-- Durable in-app notifications and transactional email outbox.
alter table public.profiles add column notification_locale text not null default 'ru'
  check(notification_locale in ('ru','kk','en'));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null check(length(event_key) between 1 and 240),
  type text not null check(type in ('application_received','application_status','manager_new_request','assignment')),
  locale text not null check(locale in ('ru','kk','en')),
  title text not null check(length(title) between 1 and 240),
  message text not null check(length(message) between 1 and 1000),
  url text not null check(length(url) between 1 and 500 and url like '/%' and url not like '//%'),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,event_key)
);
create index notifications_user_created_idx on public.notifications(user_id,created_at desc,id desc);
create index notifications_user_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check(length(event_key) between 1 and 240),
  recipient_email text not null check(length(recipient_email)<=254 and recipient_email=lower(btrim(recipient_email)) and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  locale text not null check(locale in ('ru','kk','en')),
  template_key text not null check(template_key in ('application_received','application_status','manager_new_request','assignment')),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=5000),
  status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
  attempt_count integer not null default 0 check(attempt_count between 0 and 5),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  claim_token uuid,
  provider_message_id text check(provider_message_id is null or length(provider_message_id)<=240),
  last_error_code text check(last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,80}$'),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check((status='processing')=(locked_at is not null and claim_token is not null)),
  check((status='sent')=(sent_at is not null))
);
create index email_outbox_ready_idx on public.email_outbox(available_at,created_at,id)
  where status in ('pending','processing');

alter table public.notifications enable row level security;
alter table public.email_outbox enable row level security;
revoke all on public.notifications,public.email_outbox from public,anon,authenticated,service_role;

create function public.smu_notification_copy(p_type text,p_locale text,p_status text default '',p_kind text default '')
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_locale text:=case when p_locale in ('ru','kk','en') then p_locale else 'ru' end;
 v_kind text; v_status text;
begin
 v_kind:=case p_kind
  when 'mentorship' then case v_locale when 'kk' then 'Тәлімгерлік өтінімі' when 'en' then 'Mentorship application' else 'Заявка на наставничество' end
  when 'research_program' then case v_locale when 'kk' then 'Research Program өтінімі' when 'en' then 'Research Program application' else 'Заявка в Research Program' end
  when 'research_proposal' then case v_locale when 'kk' then 'Зерттеу ұсынысы' when 'en' then 'Research proposal' else 'Исследовательское предложение' end
  when 'it_request' then case v_locale when 'kk' then 'IT өтінімі' when 'en' then 'IT request' else 'IT-заявка' end
  when 'publication_support' then case v_locale when 'kk' then 'Жарияланымға қолдау өтінімі' when 'en' then 'Publication support request' else 'Заявка на поддержку публикации' end
  else case v_locale when 'kk' then 'Өтінім' when 'en' then 'Application' else 'Заявка' end end;
 v_status:=case p_status
  when 'new' then case v_locale when 'kk' then 'қабылданды' when 'en' then 'received' else 'получена' end
  when 'in_review' then case v_locale when 'kk' then 'қаралуда' when 'en' then 'under review' else 'на рассмотрении' end
  when 'in_progress' then case v_locale when 'kk' then 'орындалуда' when 'en' then 'in progress' else 'в работе' end
  when 'accepted' then case v_locale when 'kk' then 'қабылданды' when 'en' then 'accepted' else 'принята' end
  when 'completed' then case v_locale when 'kk' then 'аяқталды' when 'en' then 'completed' else 'завершена' end
  when 'rejected' then case v_locale when 'kk' then 'қабылданбады' when 'en' then 'declined' else 'отклонена' end
  when 'withdrawn' then case v_locale when 'kk' then 'қайтарып алынды' when 'en' then 'withdrawn' else 'отозвана' end
  else p_status end;
 if p_type='application_received' then return jsonb_build_object('title',v_kind,
   'message',case v_locale when 'kk' then 'Өтініміңіз қабылданды. Күй өзгергенде хабарлаймыз.' when 'en' then 'Your application was received. We will notify you when its status changes.' else 'Ваша заявка получена. Мы сообщим, когда её статус изменится.' end);
 elsif p_type='application_status' then return jsonb_build_object('title',v_kind,
   'message',case v_locale when 'kk' then 'Жаңа күй: '||v_status||'.' when 'en' then 'New status: '||v_status||'.' else 'Новый статус: '||v_status||'.' end);
 elsif p_type='manager_new_request' then return jsonb_build_object('title',
   case v_locale when 'kk' then 'Жаңа өтінім' when 'en' then 'New application' else 'Новая заявка' end,
   'message',v_kind||case v_locale when 'kk' then ' жұмыс кезегіне түсті.' when 'en' then ' was added to the work queue.' else ' поступила в рабочую очередь.' end);
 elsif p_type='assignment' then return jsonb_build_object('title',
   case v_locale when 'kk' then 'Сізге өтінім тағайындалды' when 'en' then 'Application assigned to you' else 'Вам назначена заявка' end,
   'message',v_kind||case v_locale when 'kk' then ' сізге тағайындалды.' when 'en' then ' was assigned to you.' else ' назначена вам.' end);
 end if;
 raise exception 'invalid_notification';
end $$;
revoke all on function public.smu_notification_copy(text,text,text,text) from public,anon,authenticated,service_role;

create function public.smu_enqueue_notification(p_event_key text,p_user uuid,p_email text,p_locale text,p_type text,p_status text,p_kind text,p_url text,p_payload jsonb,p_in_app boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare v_locale text:=case when p_locale in ('ru','kk','en') then p_locale else 'ru' end; v_copy jsonb;
begin
 if p_event_key is null or length(p_event_key) not between 1 and 240 or p_type not in ('application_received','application_status','manager_new_request','assignment')
  or p_url is null or length(p_url) not between 1 and 500 or p_url not like '/%' or p_url like '//%'
  or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid_notification'; end if;
 v_copy:=public.smu_notification_copy(p_type,v_locale,p_status,p_kind);
 if p_in_app and p_user is not null then
  insert into public.notifications(user_id,event_key,type,locale,title,message,url)
   values(p_user,p_event_key,p_type,v_locale,v_copy->>'title',v_copy->>'message',p_url) on conflict(user_id,event_key) do nothing;
 end if;
 if p_email is not null then
  insert into public.email_outbox(event_key,recipient_email,locale,template_key,payload)
   values(p_event_key,lower(btrim(p_email)),v_locale,p_type,p_payload||jsonb_build_object('title',v_copy->>'title','message',v_copy->>'message','url',p_url))
   on conflict(event_key) do nothing;
 end if;
end $$;
revoke all on function public.smu_enqueue_notification(text,uuid,text,text,text,text,text,text,jsonb,boolean) from public,anon,authenticated,service_role;

create function public.smu_notify_managers(p_base_key text,p_permission text,p_type text,p_kind text,p_url text,p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_rec record;
begin
 for v_rec in select distinct pr.id,pr.notification_locale,u.email from public.profiles pr join auth.users u on u.id=pr.id
  join public.user_roles ur on ur.user_id=pr.id join public.role_permissions rp on rp.role_id=ur.role_id
  join public.permissions pe on pe.id=rp.permission_id
  where pe.code=p_permission and nullif(to_jsonb(u)->>'email_confirmed_at','') is not null
   and coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)=false and u.email is not null
 loop
  perform public.smu_enqueue_notification(p_base_key||':'||v_rec.id,v_rec.id,v_rec.email,v_rec.notification_locale,p_type,'new',p_kind,p_url,p_payload,true);
 end loop;
end $$;
revoke all on function public.smu_notify_managers(text,text,text,text,text,jsonb) from public,anon,authenticated,service_role;

create function public.smu_mentorship_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform public.smu_enqueue_notification('mentorship:'||new.id||':received',new.user_id,new.email,new.locale,'application_received','new','mentorship','/'||new.locale||'/account/applications/'||new.id,jsonb_build_object('reference',new.id,'kind','mentorship'),true);
  perform public.smu_notify_managers('mentorship:'||new.id||':manager-new','mentorship.manage','manager_new_request','mentorship','/admin/programs/mentorship/applications',jsonb_build_object('reference',new.id,'kind','mentorship'));
 elsif new.user_id is distinct from old.user_id and new.user_id is not null then
  perform public.smu_enqueue_notification('mentorship:'||new.id||':received-user',new.user_id,null,new.locale,'application_received',new.status::text,'mentorship','/'||new.locale||'/account/applications/'||new.id,jsonb_build_object('reference',new.id,'kind','mentorship'),true);
 end if;
 if tg_op='UPDATE' and new.status is distinct from old.status then
  perform public.smu_enqueue_notification('mentorship:'||new.id||':status:'||new.status,new.user_id,new.email,new.locale,'application_status',new.status::text,'mentorship','/'||new.locale||'/account/applications/'||new.id,jsonb_build_object('reference',new.id,'kind','mentorship','status',new.status),true);
 end if;
 return new;
end $$;

create function public.smu_research_program_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform public.smu_enqueue_notification('research-program:'||new.id||':received',new.user_id,new.email,new.locale,'application_received','new','research_program','/'||new.locale||'/account/research-program/'||new.id,jsonb_build_object('reference',new.id,'kind','research_program'),true);
  perform public.smu_notify_managers('research-program:'||new.id||':manager-new','research_program.manage','manager_new_request','research_program','/admin/programs/research-program/applications',jsonb_build_object('reference',new.id,'kind','research_program'));
 elsif new.user_id is distinct from old.user_id and new.user_id is not null then
  perform public.smu_enqueue_notification('research-program:'||new.id||':received-user',new.user_id,null,new.locale,'application_received',new.status::text,'research_program','/'||new.locale||'/account/research-program/'||new.id,jsonb_build_object('reference',new.id,'kind','research_program'),true);
 end if;
 if tg_op='UPDATE' and new.status is distinct from old.status then
  perform public.smu_enqueue_notification('research-program:'||new.id||':status:'||new.status,new.user_id,new.email,new.locale,'application_status',new.status::text,'research_program','/'||new.locale||'/account/research-program/'||new.id,jsonb_build_object('reference',new.id,'kind','research_program','status',new.status),true);
 end if;
 return new;
end $$;

create function public.smu_support_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_email text; v_locale text;
begin
 if tg_op='INSERT' then
  perform public.smu_enqueue_notification('support:'||new.id||':received',new.owner_id,new.email,new.locale,'application_received','new',new.kind,'/'||new.locale||'/account/support?kind='||new.kind,jsonb_build_object('reference',new.id,'kind',new.kind),true);
  perform public.smu_notify_managers('support:'||new.id||':manager-new',public.smu_support_permission(new.kind),'manager_new_request',new.kind,'/admin/support/'||new.kind,jsonb_build_object('reference',new.id,'kind',new.kind));
 else
  if new.status is distinct from old.status then
   perform public.smu_enqueue_notification('support:'||new.id||':status:'||new.status,new.owner_id,new.email,new.locale,'application_status',new.status,new.kind,'/'||new.locale||'/account/support?kind='||new.kind,jsonb_build_object('reference',new.id,'kind',new.kind,'status',new.status),true);
  end if;
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
   select u.email,p.notification_locale into v_email,v_locale from public.profiles p join auth.users u on u.id=p.id where p.id=new.assigned_to;
   perform public.smu_enqueue_notification('support:'||new.id||':assigned:'||new.version,new.assigned_to,v_email,v_locale,'assignment',new.status,new.kind,'/admin/support/'||new.kind,jsonb_build_object('reference',new.id,'kind',new.kind),true);
  end if;
 end if;
 return new;
end $$;
revoke all on function public.smu_mentorship_notifications(),public.smu_research_program_notifications(),public.smu_support_notifications() from public,anon,authenticated,service_role;

create trigger mentorship_notifications after insert or update of status,user_id on public.mentorship_applications for each row execute function public.smu_mentorship_notifications();
create trigger research_program_notifications after insert or update of status,user_id on public.research_program_applications for each row execute function public.smu_research_program_notifications();
create trigger support_notifications after insert or update of status,assigned_to on public.support_requests for each row execute function public.smu_support_notifications();

create function public.list_account_notifications(p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id();
begin
 if p_page is null or p_page not between 1 and 100000 then raise exception 'invalid_input'; end if;
 return jsonb_build_object('total',(select count(*) from public.notifications where user_id=v_actor),
  'unread',(select count(*) from public.notifications where user_id=v_actor and read_at is null),'page',p_page,'pageSize',20,
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'type',n.type,'locale',n.locale,'title',n.title,'message',n.message,'url',n.url,'readAt',n.read_at,'createdAt',n.created_at) order by n.created_at desc,n.id desc)
   from (select * from public.notifications where user_id=v_actor order by created_at desc,id desc limit 20 offset (p_page-1)*20) n),'[]'::jsonb));
end $$;
revoke all on function public.list_account_notifications(integer) from public,anon,authenticated,service_role;
grant execute on function public.list_account_notifications(integer) to authenticated;

create function public.mark_account_notification_read(p_id uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id(); v_count integer;
begin
 update public.notifications set read_at=coalesce(read_at,now()) where user_id=v_actor and read_at is null and (p_id is null or id=p_id);
 get diagnostics v_count=row_count; return v_count;
end $$;
revoke all on function public.mark_account_notification_read(uuid) from public,anon,authenticated,service_role;
grant execute on function public.mark_account_notification_read(uuid) to authenticated;

create function public.set_notification_locale(p_locale text) returns void
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.smu_account_user_id();
begin
 if p_locale is null or p_locale not in ('ru','kk','en') then raise exception 'invalid_input'; end if;
 update public.profiles set notification_locale=p_locale where id=v_actor;
end $$;
revoke all on function public.set_notification_locale(text) from public,anon,authenticated,service_role;
grant execute on function public.set_notification_locale(text) to authenticated;

create function public.claim_email_jobs(p_limit integer,p_worker uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 50 or p_worker is null then raise exception 'invalid_input'; end if;
 with candidates as (select id from public.email_outbox where attempt_count<5 and
   ((status='pending' and available_at<=now()) or (status='processing' and locked_at<now()-interval '10 minutes'))
   order by available_at,created_at,id for update skip locked limit p_limit),
 claimed as (update public.email_outbox e set status='processing',attempt_count=attempt_count+1,locked_at=now(),claim_token=p_worker,last_error_code=null
   from candidates c where e.id=c.id returning e.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'eventKey',event_key,'recipientEmail',recipient_email,'locale',locale,'templateKey',template_key,'payload',payload,'attempt',attempt_count) order by created_at,id),'[]'::jsonb) into v_result from claimed;
 return v_result;
end $$;
revoke all on function public.claim_email_jobs(integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.claim_email_jobs(integer,uuid) to service_role;

create function public.finish_email_job(p_id uuid,p_worker uuid,p_success boolean,p_provider_id text default null,p_error_code text default null,p_retryable boolean default true) returns text
language plpgsql security definer set search_path='' as $$
declare v_job public.email_outbox%rowtype; v_delay interval;
begin
 if p_id is null or p_worker is null or p_success is null or p_retryable is null then raise exception 'invalid_input'; end if;
 select * into v_job from public.email_outbox where id=p_id for update;
 if not found or v_job.status<>'processing' or v_job.claim_token is distinct from p_worker then raise exception 'stale_claim'; end if;
 if p_success then
  if p_provider_id is null or length(p_provider_id) not between 1 and 240 then raise exception 'invalid_input'; end if;
  update public.email_outbox set status='sent',sent_at=now(),provider_message_id=p_provider_id,locked_at=null,claim_token=null,last_error_code=null where id=p_id;
  return 'sent';
 end if;
 if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' then raise exception 'invalid_input'; end if;
 if not p_retryable or v_job.attempt_count>=5 then
  update public.email_outbox set status='failed',locked_at=null,claim_token=null,last_error_code=p_error_code where id=p_id;
  return 'failed';
 end if;
 v_delay:=case v_job.attempt_count when 1 then interval '1 minute' when 2 then interval '5 minutes' when 3 then interval '30 minutes' else interval '2 hours' end;
 update public.email_outbox set status='pending',available_at=now()+v_delay,locked_at=null,claim_token=null,last_error_code=p_error_code where id=p_id;
 return 'pending';
end $$;
revoke all on function public.finish_email_job(uuid,uuid,boolean,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.finish_email_job(uuid,uuid,boolean,text,text,boolean) to service_role;
