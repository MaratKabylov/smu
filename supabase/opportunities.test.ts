import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import { opportunityPageSchema, type OpportunityInput } from "../src/lib/validation/opportunity";
import { searchPageSchema } from "../src/lib/search";
let db: PGlite;
const admin = "00000000-0000-4000-a000-000000000091", other = "00000000-0000-4000-a000-000000000092", manager = "00000000-0000-4000-a000-000000000093";
const input = (extra: Partial<OpportunityInput> = {}): OpportunityInput => ({ id: null, version: null, type: "grant", country: "KZ", deadline: "2099-11-01T18:00:00+05:00", sourceUrl: "https://example.org/opportunity", translations: ["ru", "kk"].map(locale => ({ locale: locale as "ru" | "kk", slug: "water-grant", title: "Water science grant", summary: "Funding for water research in the region.", description: "Water research programme with open applications for scientists.", organization: "Science Foundation", funding: "Full funding" })), ...extra });
async function run<T = Record<string, unknown>>(actor: string | null, sql: string, args: unknown[] = [], role = actor ? "authenticated" : "anon") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try { return (await db.query<T>(sql, args)).rows; }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function save(data: unknown = input(), actor = admin) { return (await run<{ id: string }>(actor, "select public.save_opportunity($1) id", [JSON.stringify(data)]))[0].id; }
const change = (id: string, version = 1, status = "published", actor = admin) => run(actor, "select public.change_opportunity_status($1,$2,$3)", [id, version, status]);
async function list({ actor = null, manage = false, locale = "ru", page = 1, id = null, slug = null, filters = {} }: { actor?: string | null; manage?: boolean; locale?: string; page?: number; id?: string | null; slug?: string | null; filters?: Record<string, string> } = {}) {
  return opportunityPageSchema.parse((await run<{ data: unknown }>(actor, "select public.list_opportunities($1,$2,$3,$4,$5,$6) data", [locale,page,id,slug,manage,JSON.stringify(filters)]))[0].data);
}
async function search(actor: string | null = null, query = "Water", section = "opportunities", filters = {}) {
  return searchPageSchema.parse((await run<{ data: unknown }>(actor, "select public.search_public('ru',$1,$2,$3) data", [query,section,JSON.stringify(filters)]))[0].data);
}
async function seo(actor: string | null = null) { return (await run<{ data: { total: number; items: unknown[] } }>(actor, "select public.seo_public_page(1,1000,'opportunities') data"))[0].data; }
beforeAll(async () => {
  db = await createMigrationDatabase({ through: 35 });
  await db.exec(await readFile(new URL("./seed.sql",import.meta.url),"utf8"));
  for (const id of [admin,other,manager]) await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{\"role\":\"super_admin\"}')", [id, id+"@example.org"]);
  for (const [id,role] of [[admin,"admin"],[manager,"content_manager"]]) await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2", [id,role]);
  await db.query("insert into public.support_requests(id,kind,locale,title,description,contact_name,email,details) values($1,'it_request','ru','Existing request','Existing data','Contact','old@example.org','{}')",[other]);
  await db.exec(await readFile(new URL("./migrations/036_opportunities.sql",import.meta.url),"utf8"));
},30000);
beforeEach(async () => { await db.exec("truncate public.opportunity_slugs,public.opportunity_translations,public.opportunities,public.audit_logs"); });
afterAll(async () => { await db?.close(); });

it("upgrades 001–035 while preserving existing requests and assigning editorial permissions", async () => {
  expect((await db.query("select title from public.support_requests where id=$1",[other])).rows[0]).toEqual({title:"Existing request"});
  const id = await save(input(),manager);
  expect((await list({actor:manager,manage:true,id})).items[0]).toMatchObject({id,version:1,status:"draft"});
});
it("denies direct reads/writes, service-role RPCs and anonymous management", async () => {
  for (const role of ["anon","authenticated","service_role"]) {
    for (const table of ["opportunities","opportunity_translations","opportunity_slugs","search_entries"]) {
      await expect(run(admin,`select * from public.${table}`,[],role)).rejects.toThrow("permission denied");
      if(table!=="search_entries") await expect(run(admin,`delete from public.${table}`,[],role)).rejects.toThrow("permission denied");
    }
  }
  for (const role of ["anon","service_role"]) await expect(run(admin,"select public.save_opportunity($1)",[JSON.stringify(input())],role)).rejects.toThrow("permission denied");
  await expect(list({manage:true})).rejects.toThrow("forbidden");
});
it("uses database permissions, ignoring forged roles and caller-supplied actor/status", async () => {
  await expect(save(input(),other)).rejects.toThrow("forbidden");
  await expect(list({actor:other,manage:true})).rejects.toThrow("forbidden");
  const id = await save({...input(),actor:other,status:"published",publishedAt:"2000-01-01"});
  await expect(change(id,1,"published",other)).rejects.toThrow("forbidden");
  expect((await list()).total).toBe(0);
  try {
    await db.query("delete from public.user_roles where user_id=$1",[admin]);
    await expect(change(id)).rejects.toThrow("forbidden");
    await expect(list({actor:admin,manage:true})).rejects.toThrow("forbidden");
  } finally { await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='admin'",[admin]); }
});
it.each(["grant","conference","internship","competition","open_call","scholarship","other"] as const)("supports the %s type with required RU/KK and optional EN", async type => {
  const data = input({type}); data.translations.push({...data.translations[0],locale:"en"});
  const id=await save(data); await change(id);
  expect((await list({locale:"en"})).items[0]).toMatchObject({id,type});
  expect(JSON.stringify(await list())).not.toMatch(/version|actor|created_at/);
  expect((await list()).items[0].translations[0].description).toBe("");
  expect((await list({id})).items[0].translations[0].description).toContain("programme");
});
it("hides drafts, archive, deletion and future publication from catalogue, detail, search and SEO even for admin", async () => {
  const id=await save();
  const hidden=async () => {
    for (const actor of [null,admin]) {
      expect((await list({actor,id})).total).toBe(0); expect((await list({actor,slug:"water-grant"})).total).toBe(0);
      expect((await search(actor)).total).toBe(0); expect((await seo(actor)).total).toBe(0);
    }
  };
  await hidden(); await change(id); expect((await list()).total).toBe(1);
  await db.query("update public.opportunities set published_at=now()+interval '1 day' where id=$1",[id]); await hidden();
  await db.query("update public.opportunities set published_at=now()-interval '1 day',deleted_at=now() where id=$1",[id]); await hidden();
  await db.query("update public.opportunities set deleted_at=null where id=$1",[id]); await change(id,2,"archived"); await hidden();
});
it("checks stale versions, resets publication on edits, keeps first publication time and avoids duplicate status audits", async () => {
  const id=await save(); await change(id); const first=(await db.query("select published_at from public.opportunities where id=$1",[id])).rows[0];
  await expect(save(input({id,version:1}))).rejects.toThrow("stale_version");
  await change(id,2); expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(2);
  await save(input({id,version:2})); expect((await list()).total).toBe(0);
  await expect(change(id,2)).rejects.toThrow("stale_version");
  await change(id,3); expect((await db.query("select published_at from public.opportunities where id=$1",[id])).rows[0]).toEqual(first);
  await change(id,4,"archived"); await expect(change(id,5)).rejects.toThrow("invalid_transition"); await change(id,5,"draft");
});
it("preserves every slug reservation and resolves renamed public addresses without disclosing drafts", async () => {
  const id=await save(); await change(id);
  const renamed=input({id,version:2}); renamed.translations.forEach(t=>t.slug="new-grant"); await save(renamed);
  expect((await list({slug:"water-grant"})).total).toBe(0);
  await change(id,3); expect((await list({slug:"water-grant"})).items[0].translations.find(t=>t.locale==="ru")?.slug).toBe("new-grant");
  await expect(save()).rejects.toThrow("slug_reserved");
  const sameSlugOtherLocale=input(); sameSlugOtherLocale.translations.find(t=>t.locale==="ru")!.slug="another-grant";
  await expect(save(sameSlugOtherLocale)).rejects.toThrow("slug_reserved");
  expect((await db.query("select * from public.opportunities")).rows).toHaveLength(1);
});
it("supports locale-aware FTS, global/admin search, country/type/availability filters and SEO", async () => {
  const id=await save(); await change(id);
  expect((await search(null,"Foundation","",{country:"KZ",type:"grant",availability:"open"})).items[0]).toMatchObject({id,section:"opportunities",href:"/ru/opportunities/water-grant"});
  expect((await search(null,"Water","opportunities",{country:"US"})).total).toBe(0);
  expect((await list({filters:{q:"funding",country:"KZ",type:"grant",availability:"open"}})).total).toBe(1);
  expect((await list({locale:"en"})).total).toBe(0);
  expect((await seo()).items[0]).toMatchObject({id,section:"opportunities",translations:expect.arrayContaining([{locale:"ru",href:"/ru/opportunities/water-grant"}])});
  expect(searchPageSchema.parse((await run<{data:unknown}>(admin,"select public.search_admin('Water','opportunities') data"))[0].data).items[0].href).toBe("/admin/opportunities/"+id);
  await expect(run(other,"select public.search_admin('Water','opportunities') data")).rejects.toThrow("forbidden");
});
it("handles exact deadline boundaries and keeps expired entries accessible with a closed filter", async () => {
  const id=await save(input({deadline:null})); await change(id);
  expect((await list({filters:{availability:"open"}})).total).toBe(1);
  await db.query("update public.opportunities set deadline=now()-interval '1 second' where id=$1",[id]);
  expect((await list({filters:{availability:"open"}})).total).toBe(0);
  expect((await list({filters:{availability:"closed"}})).total).toBe(1);
  expect((await list({slug:"water-grant"})).total).toBe(1);
  expect((await search(null,"Water","opportunities",{availability:"closed"})).total).toBe(1);
  await db.exec("begin"); try {
    await db.query("update public.opportunities set deadline=now() where id=$1",[id]);
    expect((await list({filters:{availability:"open"}})).total).toBe(0); expect((await list({filters:{availability:"closed"}})).total).toBe(1);
  } finally {await db.exec("rollback");}
});
it("paginates with a stable order and full count", async () => {
  for(let i=0;i<14;i++){const data=input();data.translations.forEach(t=>t.slug="grant-"+i); const id=await save(data);await change(id);}
  const a=await list(),b=await list({page:2}); expect(a.total).toBe(14);expect(a.items).toHaveLength(12);expect(b.items).toHaveLength(2);
  expect(new Set([...a.items,...b.items].map(x=>x.id)).size).toBe(14); expect((await list()).items.map(x=>x.id)).toEqual(a.items.map(x=>x.id));
});
it("validates all fields and translations independently of application validation", async () => {
  for(const extra of [{type:"bad"},{country:"kz"},{deadline:"infinity"},{deadline:"2026-99-99T12:00:00Z"},{sourceUrl:"javascript:alert(1)"},{sourceUrl:"https://user:secret@example.org/a"},{translations:[input().translations[0]]},{translations:[input().translations[0],input().translations[0]]},{translations:input().translations.map(t=>({...t,title:12}))}]) await expect(save({...input(),...extra})).rejects.toThrow("invalid_input");
  expect((await db.query("select * from public.opportunities")).rows).toHaveLength(0);
  for(const filters of [{availability:"bad"},{type:"bad"},{country:"USA"}] as Record<string,string>[]) await expect(list({filters})).rejects.toThrow("invalid_input");
});
it("rolls back parent, translations, reservations and audit on translation conflicts or audit failure", async () => {
  const id=await save(),second=input(); second.translations.forEach(t=>t.slug="second-grant"); const otherId=await save(second);
  const conflict=input({id:otherId,version:1}); conflict.translations[0].slug="water-grant";
  await expect(save(conflict)).rejects.toThrow("slug_reserved");
  expect((await list({actor:admin,manage:true,id:otherId})).items[0]).toMatchObject({version:1});
  await db.exec("create function public.reject_opportunity_audit() returns trigger language plpgsql as $$ begin raise exception 'audit_down'; end $$; create trigger reject_opportunity_audit before insert on public.audit_logs for each row execute function public.reject_opportunity_audit()");
  try {
    await expect(change(id)).rejects.toThrow("audit_down");
    const third=input();third.translations.forEach(t=>t.slug="third-grant");await expect(save(third)).rejects.toThrow("audit_down");
    expect((await list({actor:admin,manage:true,id})).items[0]).toMatchObject({status:"draft",version:1});
    expect((await db.query("select * from public.opportunity_slugs where slug='third-grant'")).rows).toHaveLength(0);
    expect((await db.query("select * from public.opportunities")).rows).toHaveLength(2);
  } finally {await db.exec("drop trigger reject_opportunity_audit on public.audit_logs; drop function public.reject_opportunity_audit()");}
});
