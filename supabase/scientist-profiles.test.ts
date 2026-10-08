import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
let db: PGlite;
const admin = "00000000-0000-4000-a000-000000000001";
const manager = "00000000-0000-4000-a000-000000000002";
const user = "00000000-0000-4000-a000-000000000003";
const secondUser = "00000000-0000-4000-a000-000000000004";
let field: string;
let upgrade: Record<string, unknown>;
const translation = { fullName: "Regional Scientist", slug: "person", position: "Researcher", academicDegree: null, shortBio: "Research into regional natural resources.", biography: "A scientist working on regional development and scientific research projects." };
const input = (slug: string, patch = {}) => ({ organizationId: null, avatarMediaId: null, fieldIds: [field], publicEmail: "public@example.kz", orcid: null, scholarUrl: null, isPublic: true, collaboration: {}, links: [], ru: { ...translation, slug }, kk: { ...translation, slug }, ...patch });
async function asRole<T>(actor: string | null, action: () => Promise<T>, role = actor ? "authenticated" : "anon") {
  await db.query<Record<string, unknown>>("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try { return await action(); } finally { await db.exec("reset role"); await db.query<Record<string, unknown>>("select set_config('request.jwt.claim.sub','',false)"); }
}
const row = async (id: string) => (await db.query<Record<string, unknown>>("select * from public.scientist_profiles where id=$1", [id])).rows[0];
const version = async (id: string) => Number((await row(id)).content_version);
async function save(slug: string, patch = {}, id: string | null = null, actor = manager) {
  return asRole(actor, async () => (await db.query<{ id: string }>("select public.save_scientist($1,$2) id", [id, JSON.stringify(input(slug, patch))])).rows[0].id);
}
async function decision(id: string, status = "verified", note = "", expected?: number, actor = manager) {
  return asRole(actor, () => db.query<Record<string, unknown>>("select public.change_scientist_verification($1,$2,$3,$4)", [id,status,expected ?? null,note]));
}
async function verified(slug: string, patch = {}) { const id = await save(slug, patch); await decision(id, "verified", "", await version(id)); return id; }
async function link(id: string, email: string, actor = admin, expected?: number) {
  return asRole(actor, () => db.query<Record<string, unknown>>("select public.link_scientist_account($1,$2,$3)", [id,email,expected ?? null]));
}
async function merge(source: string, target: string, actor = manager, sourceVersion?: number, targetVersion?: number) {
  return asRole(actor, () => db.query<Record<string, unknown>>("select public.merge_scientists($1,$2,$3,$4,$5)", [source,target,sourceVersion ?? null,targetVersion ?? null,"Duplicate identity confirmed by the editorial team."]));
}
async function publicSearch(section: string, actor: string | null = null) {
  return asRole(actor, async () => (await db.query<{ result: { total: number; items: { id: string }[] } }>("select public.search_public('ru','',$1) result", [section])).rows[0].result);
}
async function graph(person: string, slug = "linked") {
  const publication = (await db.query<{ id: string }>("insert into public.publications(scientist_id,title,year,journal,publication_type,status,published_at,created_by) values($1,'Scientific Paper',2026,'Scientific Journal','article','published',now(),$2) returning id", [person,admin])).rows[0].id;
  const work = (await db.query<{ id: string }>("insert into public.science_works(kind,field_id,created_by,status,published_at) values('project',$1,$2,'published',now()) returning id", [field,admin])).rows[0].id;
  await db.query<Record<string, unknown>>("insert into public.science_work_members values($1,$2,'lead')", [work,person]);
  const offer = (await db.query<{ id: string }>("insert into public.mentorship_offers(scientist_id,field_id,format,capacity,created_by,status) values($1,$2,'online',5,$3,'published') returning id", [person,field,admin])).rows[0].id;
  const program = (await db.query<{ id: string }>("insert into public.research_programs(coordinator_id,field_id,format,capacity,created_by,applications_open_on,application_deadline,starts_on,ends_on,status) values($1,$2,'online',5,$3,'2026-01-01','2026-12-01','2026-12-02','2026-12-03','published') returning id", [person,field,admin])).rows[0].id;
  const article = (await db.query<{ id: string }>("insert into public.articles(author_id,status,approved_version,published_at) values($1,'published',1,now()) returning id", [admin])).rows[0].id;
  await db.query<Record<string, unknown>>("insert into public.article_scientists values($1,$2,'expert',0)", [article,person]);
  for (const locale of ["ru","kk","en"]) {
    await db.query<Record<string, unknown>>("insert into public.article_translations(article_id,locale,title,slug,excerpt,body) values($1,$2,'Editorial Article',$3,'Scientific excerpt','A detailed article about the regional scientist and their work.')", [article,locale,slug]);
    await db.query<Record<string, unknown>>("insert into public.science_work_translations(work_id,locale,title,slug,summary,description) values($1,$2,'Regional Project',$3,'Regional scientific project overview.','A detailed description of the regional scientific project.')", [work,locale,slug]);
    await db.query<Record<string, unknown>>("insert into public.mentorship_offer_translations values($1,$2,'Mentoring Offer',$3,'Regional scientific mentorship overview.','A detailed description of the regional scientific mentorship.')", [offer,locale,slug]);
    await db.query<Record<string, unknown>>("insert into public.research_program_translations values($1,$2,'Research Program',$3,'Regional research program overview.','A detailed description of the regional research program.','Training in modern research methods.','Researchers and graduate students.','Research results and scientific skills.')", [program,locale,slug]);
  }
  return { publication, work, offer, program, article };
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key,bucket_id text); alter table storage.objects enable row level security; grant usage on schema public,auth,storage to anon,authenticated,service_role;");
  for (const name of (await readdir(new URL('./migrations/',import.meta.url))).filter(n => n.endsWith('.sql') && n < '025').sort()) await db.exec((await readFile(new URL('./migrations/' + name,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''));
  await db.exec(await readFile(new URL('./seed.sql',import.meta.url),'utf8'));
  for (const [id,role,email] of [[admin,'admin','admin@example.kz'],[manager,'scientist_manager','manager@example.kz'],[user,'user','user@example.kz'],[secondUser,'user','second@example.kz']]) {
    await db.query<Record<string, unknown>>("insert into auth.users values($1,$2,'{}')", [id,email]);
    await db.query<Record<string, unknown>>("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2", [id,role]);
  }
  const legacy = (await db.query<{ id: string }>("insert into public.scientist_profiles(created_by,status,verified_at,orcid,scholar_url) values($1,'verified',now(),'0000-0002-1825-0097','https://legacy.example.kz/profile') returning id", [admin])).rows[0].id;
  await db.exec(await readFile(new URL('./migrations/025_scientist_profiles.sql',import.meta.url),'utf8'));
  upgrade = { ...(await row(legacy)), links: (await db.query<Record<string, unknown>>("select type,url from public.scientist_links where scientist_id=$1 order by type", [legacy])).rows };
  field = (await db.query<{ id: string }>("insert into public.scientific_fields(slug,name_ru,name_kk) values('science','Наука','Ғылым') returning id")).rows[0].id;
},30000);
beforeEach(async () => { await db.exec("truncate public.scientist_profiles,public.articles,public.science_works,public.audit_logs,public.slug_redirects cascade"); });
afterAll(async () => { await db?.close(); });

describe("scientist profile lifecycle and privacy", () => {
  it("backfills old verification and links without changing publication or legacy URLs", () => {
    expect(upgrade).toMatchObject({ status: 'verified', verification_status: 'verified', is_public: true, content_version: 1, scholar_url: 'https://legacy.example.kz/profile', links: [{ type: 'orcid', url: 'https://orcid.org/0000-0002-1825-0097' },{ type: 'website',url: 'https://legacy.example.kz/profile' }] });
  });
  it("separates public visibility from verification and persists collaboration and six typed links", async () => {
    const links = [{ type: 'orcid',url:'https://orcid.org/0000-0002-1825-0097' },{type:'google_scholar',url:'https://scholar.google.com/citations?user=researcher'},{type:'scopus',url:'https://www.scopus.com/authid/detail.uri?authorId=1'},{type:'researchgate',url:'https://www.researchgate.net/profile/Scientist'},{type:'linkedin',url:'https://www.linkedin.com/in/scientist'},{type:'website',url:'https://example.kz'}];
    const id = await verified('private',{ isPublic:false, collaboration:{coauthoring:true,mentoring:false},links });
    expect(await row(id)).toMatchObject({ status:'verified',verification_status:'verified',is_public:false,collaboration:{coauthoring:true,mentoring:false},orcid:'0000-0002-1825-0097' });
    expect((await db.query<Record<string, unknown>>('select type,url from public.scientist_links where scientist_id=$1',[id])).rows).toHaveLength(6);
    expect((await publicSearch('scientists')).total).toBe(0);
  });
  it("supports pending/rejected with private feedback and resets it on content edits", async () => {
    const id = await save('review');
    await decision(id,'pending','Waiting for documents.',await version(id));
    await expect(decision(id,'rejected','',await version(id))).rejects.toThrow('invalid_input');
    await decision(id,'rejected','Need proof of academic degree.',await version(id));
    expect(await row(id)).toMatchObject({ status:'draft',verification_status:'rejected',verification_note:'Need proof of academic degree.' });
    await save('review',{expectedContentVersion:await version(id)},id);
    expect(await row(id)).toMatchObject({ verification_status:'unverified',verification_note:null });
  });
  it("requires the RU/KK pair when English is present instead of counting arbitrary two translations", async () => {
    const id = await save('required-locales');
    await db.query("delete from public.scientist_profile_translations where scientist_profile_id=$1 and locale='kk'", [id]);
    await db.query("insert into public.scientist_profile_translations(scientist_profile_id,locale,full_name,slug,position,short_bio,biography) select scientist_profile_id,'en',full_name,slug,position,short_bio,biography from public.scientist_profile_translations where scientist_profile_id=$1 and locale='ru'", [id]);
    await expect(decision(id,'verified','',await version(id))).rejects.toThrow('invalid_transition');
    expect((await row(id)).verification_status).toBe('unverified');
  });
  it("rejects stale/missing versions, repeated decisions and the legacy verification bypass", async () => {
    const id = await verified('versions'); const before = await row(id);
    await expect(save('versions',{},id)).rejects.toThrow('stale_version');
    await expect(save('versions',{expectedContentVersion:1},id)).rejects.toThrow('stale_version');
    await expect(decision(id,'pending','',1)).rejects.toThrow('stale_version');
    await expect(decision(id,'pending')).rejects.toThrow('stale_version');
    await expect(decision(id,'verified','',await version(id))).rejects.toThrow('invalid_transition');
    await expect(asRole(manager,() => db.query<Record<string, unknown>>("select public.change_scientist_state($1,'draft',false)",[id]))).rejects.toThrow('invalid_transition');
    expect(await row(id)).toEqual(before);
  });
  it.each([
    { links: [{type:'website',url:'javascript:alert(1)'}] }, { links: [{type:'orcid',url:'https://orcid.org.evil.test/0000-0002-1825-0097'}] },
    { links: [{type:'google_scholar',url:'https://example.kz'}] }, { links: [{type:'website',url:'https://user:password@example.kz'}] },
    { links: [{type:'website',url:'https://example.kz'},{type:'website',url:'https://other.kz'}] },
    { collaboration: {secret: true} }, {collaboration:{mentoring:'true'}}, {isPublic:'true'}, {links:null},
  ])("rolls back invalid direct RPC input %#", async patch => {
    const id = await verified('invalid'); const before = await row(id); const audit = (await db.query<Record<string, unknown>>('select * from public.audit_logs')).rows;
    await expect(save('invalid',{...patch,expectedContentVersion:await version(id)},id)).rejects.toThrow('invalid_input');
    expect(await row(id)).toEqual(before); expect((await db.query<Record<string, unknown>>('select * from public.audit_logs')).rows).toEqual(audit);
  });
  it("hides private profiles across RLS, linked pages, search, relations and SEO even for administrators", async () => {
    const id = await verified('visible',{links:[{type:'website',url:'https://example.kz'}]}); const linked = await graph(id);
    for (const section of ['scientists','publications','mentorship','research-program']) expect((await publicSearch(section)).total).toBe(1);
    await db.query<Record<string, unknown>>('update public.scientist_profiles set is_public=false where id=$1',[id]);
    for (const actor of [null,admin]) {
      for (const section of ['scientists','publications','mentorship','research-program']) expect((await publicSearch(section,actor)).total).toBe(0);
      expect((await asRole(actor,() => db.query<Record<string, unknown>>("select * from public.list_public_publications('ru')"))).rows).toEqual([]);
      expect((await asRole(actor,() => db.query<Record<string, unknown>>("select * from public.public_article_relations($1,'ru')",[linked.article]))).rows).toEqual([]);
      const seo = (await asRole(actor,() => db.query<{ result:{total:number} }>("select public.seo_public_page(1,1000,'scientists',$1) result",[id]))).rows[0].result; expect(seo.total).toBe(0);
    }
    for (const table of ['scientist_profiles','scientist_profile_translations','scientist_links','scientist_field_links','publications','mentorship_offers','research_programs','science_work_members']) expect((await asRole(null,() => db.query<Record<string, unknown>>('select count(*)::int count from public.' + table))).rows).toEqual([{count:0}]);
    expect((await row(id)).verification_status).toBe('verified');
  });
  it("protects account IDs, review comments, merge snapshots and internal functions from public readers", async () => {
    const id = await verified('public');
    for (const actor of [null,user]) {
      for (const column of ['user_id','verification_note','verified_by','created_by','merged_into_id']) await expect(asRole(actor,() => db.query<Record<string, unknown>>('select ' + column + ' from public.scientist_profiles'))).rejects.toThrow('permission denied');
      await expect(asRole(actor,() => db.query<Record<string, unknown>>('select * from public.list_scientist_profiles()'))).rejects.toThrow(actor ? 'forbidden' : 'permission denied');
      await expect(asRole(actor,() => db.query<Record<string, unknown>>('select public.save_scientist_core($1,$2)',[id,JSON.stringify(input('public'))]))).rejects.toThrow('permission denied');
      if (actor) expect((await asRole(actor,() => db.query<Record<string, unknown>>('select * from public.scientist_merges'))).rows).toEqual([]);
      else await expect(asRole(actor,() => db.query<Record<string, unknown>>('select * from public.scientist_merges'))).rejects.toThrow('permission denied');
    }
    expect((await asRole(manager,() => db.query<Record<string, unknown>>('select * from public.list_scientist_profiles()'))).rows).toHaveLength(1);
  });
  it("requires user management to link accounts, preserves role grants and rejects conflicts/stale assignment", async () => {
    const first = await verified('first'); const second = await verified('second');
    await expect(link(first,'user@example.kz',manager,await version(first))).rejects.toThrow('forbidden');
    await expect(link(first,'missing@example.kz',admin,await version(first))).rejects.toThrow('invalid_reference');
    const roles = (await db.query<Record<string, unknown>>('select * from public.user_roles where user_id=$1',[user])).rows;
    await link(first,'USER@example.kz',admin,await version(first)); expect((await row(first)).user_id).toBe(user);
    expect((await asRole(admin,() => db.query("select * from public.scientist_linked_account($1)",[first]))).rows).toMatchObject([{email:'user@example.kz'}]);
    await expect(asRole(manager,() => db.query("select * from public.scientist_linked_account($1)",[first]))).rejects.toThrow('forbidden');
    await expect(link(second,'user@example.kz',admin,await version(second))).rejects.toThrow('invalid_reference');
    await expect(link(first,'',admin,1)).rejects.toThrow('stale_version');
    expect((await db.query<Record<string, unknown>>('select * from public.user_roles where user_id=$1',[user])).rows).toEqual(roles);
    await link(first,'',admin,await version(first)); expect((await row(first)).user_id).toBeNull();
  });
});
describe("atomic scientist merging", () => {
  it("retargets the graph, deduplicates memberships, resets approval/schedules and preserves snapshots/slugs", async () => {
    const source = await verified('source',{links:[{type:'orcid',url:'https://orcid.org/0000-0002-1825-0097'}]});
    const target = await verified('target',{collaboration:{coauthoring:true}}); const linked = await graph(source);
    await db.query<Record<string, unknown>>("insert into public.science_work_members values($1,$2,'member')",[linked.work,target]);
    await db.query<Record<string, unknown>>("insert into public.article_scientists values($1,$2,'subject',1)",[linked.article,target]);
    await db.query<Record<string, unknown>>("update public.articles set status='scheduled',scheduled_at=now()+interval '1 day',scheduled_by=$2 where id=$1",[linked.article,admin]);
    await db.query<Record<string, unknown>>("insert into public.slug_redirects(entity_type,entity_id,locale,old_slug) values('scientist',$1,'ru','older-source')",[source]);
    await merge(source,target,manager,await version(source),await version(target));
    expect((await asRole(manager,() => db.query("select * from public.list_deleted_editorial_records('scientist')"))).rows).toEqual([]);
    expect(await row(source)).toMatchObject({merged_into_id:target,status:'draft'}); expect((await row(source)).deleted_at).not.toBeNull();
    expect(await row(target)).toMatchObject({verification_status:'unverified',collaboration:{coauthoring:true},orcid:'0000-0002-1825-0097'});
    expect((await db.query<Record<string, unknown>>('select scientist_id,role from public.science_work_members where work_id=$1',[linked.work])).rows).toEqual([{scientist_id:target,role:'lead'}]);
    expect((await db.query<Record<string, unknown>>('select scientist_id from public.publications where id=$1',[linked.publication])).rows[0].scientist_id).toBe(target);
    expect((await db.query<Record<string, unknown>>('select scientist_id from public.mentorship_offers where id=$1',[linked.offer])).rows[0].scientist_id).toBe(target);
    expect((await db.query<Record<string, unknown>>('select coordinator_id from public.research_programs where id=$1',[linked.program])).rows[0].coordinator_id).toBe(target);
    expect((await db.query<Record<string, unknown>>('select scientist_id,relation_type from public.article_scientists where article_id=$1',[linked.article])).rows).toEqual([{scientist_id:target,relation_type:'subject'}]);
    expect((await db.query<Record<string, unknown>>('select status,content_version,approved_version,scheduled_at from public.articles where id=$1',[linked.article])).rows[0]).toEqual({status:'draft',content_version:2,approved_version:null,scheduled_at:null});
    expect((await db.query<Record<string, unknown>>('select source_snapshot from public.scientist_merges')).rows[0].source_snapshot).toMatchObject({profile:{id:source},articles:[{scientist_id:source}],publications:[linked.publication]});
    expect((await asRole(null,() => db.query<Record<string, unknown>>("select * from public.slug_redirects where old_slug='source'"))).rows).toEqual([]);
    await decision(target,'verified','',await version(target));
    expect((await asRole(null,() => db.query<Record<string, unknown>>("select entity_id from public.slug_redirects where entity_type='scientist' and locale='ru' and old_slug in ('source','older-source')"))).rows).toEqual([{entity_id:target},{entity_id:target}]);
    await expect(save('source')).rejects.toThrow(/slug_reserved|unique constraint/);
    const deletedAt = (await db.query<{ token: string }>("select deleted_at::text token from public.scientist_profiles where id=$1", [source])).rows[0].token;
    await expect(asRole(manager,() => db.query<Record<string, unknown>>('select public.restore_deleted_scientist($1,$2)',[source,deletedAt]))).rejects.toThrow('invalid_transition');
  });
  it("keeps merged data private if either profile was private", async () => {
    const source = await verified('source',{isPublic:false}); const target = await verified('target');
    await merge(source,target,manager,await version(source),await version(target)); await decision(target,'verified','',await version(target));
    expect((await row(target)).is_public).toBe(false); expect((await publicSearch('scientists')).total).toBe(0);
  });
  it("transfers accounts only with user management and refuses two distinct owners", async () => {
    const source = await verified('source'); const target = await verified('target');
    await link(source,'user@example.kz',admin,await version(source));
    await expect(merge(source,target,manager,await version(source),await version(target))).rejects.toThrow('forbidden');
    await link(target,'second@example.kz',admin,await version(target));
    await expect(merge(source,target,admin,await version(source),await version(target))).rejects.toThrow('invalid_reference');
    await link(target,'',admin,await version(target)); await merge(source,target,admin,await version(source),await version(target));
    expect((await row(source)).user_id).toBeNull(); expect((await row(target)).user_id).toBe(user);
  });
  it("rejects stale/repeated merges, conflicting identity links and unauthorized callers without partial writes", async () => {
    const source = await verified('source',{links:[{type:'website',url:'https://source.kz'}]}); const target = await verified('target',{links:[{type:'website',url:'https://target.kz'}]});
    const original = [await row(source),await row(target)];
    await expect(merge(source,target,user,await version(source),await version(target))).rejects.toThrow('forbidden');
    await expect(merge(source,target,manager,1,await version(target))).rejects.toThrow('stale_version');
    await expect(merge(source,target,manager,await version(source),await version(target))).rejects.toThrow('invalid_reference');
    expect([await row(source),await row(target)]).toEqual(original); expect((await db.query<Record<string, unknown>>('select * from public.scientist_merges')).rows).toEqual([]);
    await save('source',{links:[],expectedContentVersion:await version(source)},source);
    await merge(source,target,manager,await version(source),await version(target));
    await expect(merge(source,target,manager,await version(source),await version(target))).rejects.toThrow('not_found');
  });
  it("rolls back all graph changes and snapshots if the final audit fails", async () => {
    const source = await verified('source'); const target = await verified('target'); const linked = await graph(source);
    const original = [await row(source),await row(target)];
    await db.exec("create function public.fail_merge_audit() returns trigger language plpgsql as $$ begin if new.action='scientist.merge' then raise exception 'audit unavailable'; end if; return new; end $$; create trigger fail_merge before insert on public.audit_logs for each row execute function public.fail_merge_audit()");
    try { await expect(merge(source,target,manager,await version(source),await version(target))).rejects.toThrow('audit unavailable'); }
    finally { await db.exec('drop trigger fail_merge on public.audit_logs; drop function public.fail_merge_audit()'); }
    expect([await row(source),await row(target)]).toEqual(original); expect((await db.query<Record<string, unknown>>('select * from public.scientist_merges')).rows).toEqual([]);
    expect((await db.query<Record<string, unknown>>('select scientist_id from public.publications where id=$1',[linked.publication])).rows[0].scientist_id).toBe(source);
    expect((await db.query<Record<string, unknown>>('select scientist_id from public.article_scientists where article_id=$1',[linked.article])).rows[0].scientist_id).toBe(source);
    expect((await db.query<Record<string, unknown>>('select status from public.articles where id=$1',[linked.article])).rows[0].status).toBe('published');
  });
});
