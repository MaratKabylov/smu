begin;

-- Shared across application instances and all public application forms.
-- Only keyed digests are stored; no IP addresses, contacts or form contents.
create table public.public_form_limits (
  key text primary key check (key ~ '^(network_short|network_day|email_day):[a-f0-9]{64}$'),
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null
);
create index public_form_limits_expiry_idx on public.public_form_limits(expires_at);
alter table public.public_form_limits enable row level security;
revoke all on public.public_form_limits from public, anon, authenticated, service_role;

create function public.consume_public_form_limit(p_network_key text, p_email_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz;
  v_key text;
  v_keys text[];
  v_limits integer[] := array[3,20,5];
  v_windows interval[] := array[interval '24 hours',interval '24 hours',interval '10 minutes'];
  v_row public.public_form_limits;
  i integer;
begin
  if p_network_key is null or p_network_key !~ '^[a-f0-9]{64}$'
    or p_email_key is null or p_email_key !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_input';
  end if;
  -- The same sorted lock order for every call prevents deadlocks when email
  -- and network overlap independently. Locks also protect absent bucket rows.
  v_keys := array['email_day:'||p_email_key,'network_day:'||p_network_key,'network_short:'||p_network_key];
  foreach v_key in array v_keys loop
    perform pg_advisory_xact_lock(hashtextextended(v_key, 370037));
  end loop;
  v_now := clock_timestamp();
  for i in 1..3 loop
    select * into v_row from public.public_form_limits where key=v_keys[i];
    if found and v_row.expires_at>v_now and v_row.attempts>=v_limits[i] then
      return false;
    end if;
  end loop;
  for i in 1..3 loop
    insert into public.public_form_limits(key,attempts,expires_at)
      values(v_keys[i],1,v_now+v_windows[i])
    on conflict(key) do update set
      attempts=case when public.public_form_limits.expires_at<=v_now then 1 else public.public_form_limits.attempts+1 end,
      expires_at=case when public.public_form_limits.expires_at<=v_now then excluded.expires_at else public.public_form_limits.expires_at end;
  end loop;
  -- Bounded opportunistic retention; skip rows being changed by other callers.
  delete from public.public_form_limits where key in (
    select key from public.public_form_limits where expires_at<=v_now
    order by expires_at limit 1000 for update skip locked
  );
  return true;
end;
$$;
revoke all on function public.consume_public_form_limit(text,text) from public,anon,authenticated,service_role;
grant execute on function public.consume_public_form_limit(text,text) to service_role;

commit;
