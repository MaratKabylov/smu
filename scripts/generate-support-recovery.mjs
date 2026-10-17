import { readFile, mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createMigrationDatabase } from "./database-schema.mjs";

// Derive the recovery checks from the actual executed 035 schema, rather than
// maintaining a second handwritten schema. Never change the original migration.
export async function supportRecoveryArtifacts() {
  const db = await createMigrationDatabase({ through: 35 });
  try {
    const tables = ["support_requests", "support_request_files"];
    const names = ["smu_support_permission", "smu_can_manage_support", "submit_support_request", "update_support_request", "list_support_requests", "support_request_assignees", "resolve_support_request_file"];
    const expected = {};
    expected.columns = (await db.query(`select c.relname as tbl,
      jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
        pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) order by a.attnum) as cols
      from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
      left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
      where n.nspname='public' and c.relname=any($1) and a.attnum>0 and not a.attisdropped group by c.relname`, [tables])).rows;
    expected.constraints = (await db.query(`select t.relname as tbl,c.conname as name,replace(pg_get_constraintdef(c.oid),'public.','') as def
      from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname=any($1) and c.contype in ('p','u','f','c') order by t.relname,c.conname`, [tables])).rows;
    expected.indexes = (await db.query(`select i.relname as name,replace(pg_get_indexdef(i.oid),'public.','') as def
      from pg_index x join pg_class i on i.oid=x.indexrelid join pg_class t on t.oid=x.indrelid
      join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=any($1) order by i.relname`, [tables])).rows;
    expected.functions = (await db.query(`select p.oid::regprocedure::text as sig,md5(replace(p.prosrc,chr(13),'')) as body,
      p.prosecdef as sec,p.provolatile::text as vol,p.proconfig as config,p.proretset as retset,
      format_type(p.prorettype,null) as ret,p.proargnames as args,p.pronargdefaults as defaults,
      pg_get_expr(p.proargdefaults,0) as default_expr,l.lanname as lang
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
      where n.nspname='public' and p.proname=any($1) order by p.proname`, [names])).rows.map(f => ({ ...f, sig: f.sig.startsWith("public.") ? f.sig : `public.${f.sig}` }));
    const snapshot = `$smu035$${JSON.stringify(expected)}$smu035$::jsonb`;
    const ctes = `with expected as (select ${snapshot} as data),
columns_expected as (select * from jsonb_to_recordset((select data->'columns' from expected)) as x(tbl text,cols jsonb)),
constraints_expected as (select * from jsonb_to_recordset((select data->'constraints' from expected)) as x(tbl text,name text,def text)),
indexes_expected as (select * from jsonb_to_recordset((select data->'indexes' from expected)) as x(name text,def text)),
functions_expected as (select * from jsonb_to_recordset((select data->'functions' from expected)) as x(sig text,body text,sec boolean,vol text,config text[],retset boolean,ret text,args text[],defaults integer,default_expr text,lang text)),
checks as (
 select 'columns:'||e.tbl as check_name,coalesce((select c.relkind='r' and
   (select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
     pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated) order by a.attnum)
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)=e.cols
   from pg_class c where c.oid=to_regclass('public.'||e.tbl)),false) as ok from columns_expected e
 union all select 'constraint:'||e.name,exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.'||e.tbl)
   and c.conname=e.name and c.convalidated and replace(pg_get_constraintdef(c.oid),'public.','')=e.def) from constraints_expected e
 union all select 'index:'||e.name,exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.'||e.name)
   and i.indisvalid and i.indisready and replace(pg_get_indexdef(i.indexrelid),'public.','')=e.def) from indexes_expected e
 union all select 'rls:'||e.tbl,coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.'||e.tbl)),false) from columns_expected e
 union all select 'table_privileges:'||e.tbl,to_regclass('public.'||e.tbl) is not null and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
   where has_table_privilege(r.role_name,to_regclass('public.'||e.tbl),p.priv)) and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   cross join (values('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(priv)
   where has_any_column_privilege(r.role_name,to_regclass('public.'||e.tbl),p.priv)) from columns_expected e
 union all select 'function:'||e.sig,exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(e.sig)
   and md5(replace(p.prosrc,chr(13),''))=e.body and p.prosecdef=e.sec and p.provolatile::text=e.vol
   and p.proconfig is not distinct from e.config and p.proretset=e.retset and format_type(p.prorettype,null)=e.ret
   and p.proargnames is not distinct from e.args and p.pronargdefaults=e.defaults
   and pg_get_expr(p.proargdefaults,0) is not distinct from e.default_expr and l.lanname=e.lang) from functions_expected e
 union all select 'function_privileges:'||e.sig,to_regprocedure(e.sig) is not null and not exists(
   select 1 from (values('anon'),('authenticated'),('service_role')) r(role_name)
   where has_function_privilege(r.role_name,to_regprocedure(e.sig),'EXECUTE') is distinct from
    (case when e.sig like 'public.submit_support_request(%' then r.role_name='service_role'
      when e.sig like 'public.smu_%' then false else r.role_name='authenticated' end)) from functions_expected e
 union all select 'permission:'||p.code,exists(select 1 from public.permissions q where q.code=p.code)
   from (values('research_proposals.manage'),('it_requests.manage'),('publication_support.manage')) p(code)
 union all select 'role:'||r.code,exists(select 1 from public.roles rr where rr.code=r.code)
   from (values('admin'),('super_admin')) r(code)
 union all select 'role_permission:'||r.code||':'||p.code,exists(select 1 from public.role_permissions rp
   join public.roles rr on rr.id=rp.role_id join public.permissions pp on pp.id=rp.permission_id where rr.code=r.code and pp.code=p.code)
   from (values('admin'),('super_admin')) r(code)
   cross join (values('research_proposals.manage'),('it_requests.manage'),('publication_support.manage')) p(code)
 union all select 'storage_bucket',exists(select 1 from storage.buckets where id='support-request-files'
   and name='support-request-files' and public=false and file_size_limit=1048576 and allowed_mime_types=array['application/pdf']::text[])
)`;
    const query = `${ctes}\nselect check_name,ok from checks order by ok,check_name;\n`;
    const verify = `-- Read-only schema verification for migration 035. Run the WHOLE file in SQL Editor.\n-- Every row must show ok=true. No application data or migration history is changed.\n-- Intended for the 035 schema, before subsequent schema-changing migrations.\n${query}`;
    const original = (await readFile(new URL("../supabase/migrations/035_support_requests.sql", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
    const ingress = "values('support-request-files','support-request-files',false,1048576,array['application/pdf']);";
    if (!original.includes(ingress)) throw new Error("035 bucket SQL changed; review recovery generation");
    const repeated = original.replaceAll("create table public.", "create table if not exists public.")
      .replaceAll("create index ", "create index if not exists ")
      .replaceAll("create function public.", "create or replace function public.")
      .replace(ingress, `values('support-request-files','support-request-files',false,1048576,array['application/pdf'])\non conflict(id) do update set name=excluded.name,public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;`);
    const guard = `${ctes}\nselect string_agg(check_name,', ' order by check_name) into v_failed from checks where not ok\n`;
    const reapply = `-- Recovery of an interrupted/manual 035 run. Run the WHOLE file, as postgres.\n-- Preserves rows/files. Reinstalls 035 functions and ACLs. Does not change migration history.\n-- For the 035 schema only; do not use to roll back later migrations.\nbegin;\nset local lock_timeout='5s';\nset local statement_timeout='60s';\n-- Existing tables must have the exact 035 columns/defaults/constraints.\ndo $preflight$\ndeclare v_failed text; v_tbl text;\nbegin\n  foreach v_tbl in array array['support_requests','support_request_files'] loop\n    if to_regclass('public.'||v_tbl) is not null then\n      execute format('lock table public.%I in share row exclusive mode',v_tbl);\n    end if;\n  end loop;\n  ${ctes}\n  select string_agg(check_name,', ' order by check_name) into v_failed from checks\n   where not ok and ((check_name like 'columns:%' and to_regclass('public.'||split_part(check_name,':',2)) is not null)\n    or (check_name like 'constraint:%' and exists(select 1 from constraints_expected e where 'constraint:'||e.name=check_name and to_regclass('public.'||e.tbl) is not null)));\n  if v_failed is not null then raise exception '035 incompatible existing schema: %. No changes committed.',v_failed; end if;\nend $preflight$;\n\n${repeated}\n\n-- Do not commit unless all schema, definitions, ACLs and bucket checks pass.\ndo $verification$\ndeclare v_failed text;\nbegin\n  ${guard};\n  if v_failed is not null then raise exception '035 verification failed: %. No changes committed.',v_failed; end if;\nend $verification$;\nnotify pgrst, 'reload schema';\ncommit;\n${query}`;
    const prerequisiteCheck = `-- 035 assigns permissions to existing roles; their definitions come from seed.sql.
do $prerequisites$
declare v_missing text;
begin
  select string_agg(r.code,', ' order by r.code) into v_missing
  from (values('admin'),('super_admin')) r(code)
  where not exists(select 1 from public.roles p where p.code=r.code);
  if v_missing is not null then
    raise exception '035 missing prerequisite roles: %. Apply supabase/seed.sql, then retry. No changes committed.',v_missing;
  end if;
end $prerequisites$;
`;
    return { verify, reapply: reapply.replace("-- Existing tables must", `${prerequisiteCheck}\n-- Existing tables must`) };
  } finally { await db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const artifacts = await supportRecoveryArtifacts();
  const directory = new URL("../supabase/maintenance/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("verify_035_support_requests.sql", directory), artifacts.verify);
  await writeFile(new URL("reapply_035_support_requests.sql", directory), artifacts.reapply);
  console.log("Generated read-only verification and transactional recovery SQL for 035.");
}
