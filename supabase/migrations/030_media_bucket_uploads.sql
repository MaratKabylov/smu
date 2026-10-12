-- Clients upload only to private staging. Verified server bytes are written to
-- the destination with a service credential before the atomic ready/audit RPC.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('media-staging','media-staging',false,52428800,array[
  'image/jpeg','image/png','image/webp','image/gif','video/mp4',
  'application/pdf','text/csv','application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
update storage.buckets set allowed_mime_types=array['application/pdf','text/csv','application/zip','image/jpeg','image/png','image/webp','image/gif']
where id='it-request-files';

-- Revoke broad object access: media.view must not expose staged/deleted bytes
-- or allow callers to bypass the fresh download authorization endpoint.
drop policy if exists "media_objects_read_authorized" on storage.objects;

create function public.finalize_media_upload(p_id uuid,p_actor uuid,p_mime_type text,p_file_size bigint,p_width integer,p_height integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_asset public.media_assets; v_limit bigint; v_mimes text[];
begin
  if p_actor is null or not exists(
    select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id
      join public.permissions p on p.id=rp.permission_id where ur.user_id=p_actor and p.code='admin.access'
  ) or not exists(
    select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id
      join public.permissions p on p.id=rp.permission_id where ur.user_id=p_actor and p.code='media.create'
  ) then raise exception 'forbidden'; end if;
  select * into v_asset from public.media_assets where id=p_id for update;
  if not found or v_asset.deleted_at is not null or v_asset.status<>'uploading' then raise exception 'not_found'; end if;
  if v_asset.uploaded_by<>p_actor then raise exception 'forbidden'; end if;
  if v_asset.storage_bucket not in ('avatars','organization-logos','article-media','event-media','research-files','publication-files','documents','it-request-files') then raise exception 'invalid_input'; end if;
  select file_size_limit,allowed_mime_types into v_limit,v_mimes from storage.buckets where id=v_asset.storage_bucket;
  if not found or v_limit is null or v_mimes is null then raise exception 'invalid_input'; end if;
  if p_file_size is null or p_file_size<=0 or p_file_size>v_limit or p_file_size<>v_asset.file_size
    or p_mime_type is null or p_mime_type<>v_asset.mime_type or not(p_mime_type=any(v_mimes))
    or ((p_width is null)<>(p_height is null)) or p_width<=0 or p_height<=0
    or (p_mime_type like 'image/%' and (p_width is null or p_height is null or p_width::bigint*p_height>40000000))
    or (p_mime_type not like 'image/%' and (p_width is not null or p_height is not null))
    then raise exception 'invalid_input'; end if;
  update public.media_assets set status='ready',width=p_width,height=p_height where id=p_id;
  insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data)
  values(p_actor,'media_asset',p_id,'media.upload',jsonb_build_object(
    'storageBucket',v_asset.storage_bucket,'storagePath',v_asset.storage_path,
    'mimeType',p_mime_type,'fileSize',p_file_size));
end $$;
revoke all on function public.finalize_media_upload(uuid,uuid,text,bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.finalize_media_upload(uuid,uuid,text,bigint,integer,integer) to service_role;
comment on function public.finalize_media_upload(uuid,uuid,text,bigint,integer,integer) is
  'Trusted server only, after actual byte validation and destination Storage write. Ready status and audit are atomic.';
