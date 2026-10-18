import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({list:vi.fn(),get:vi.fn(),access:vi.fn(),adminList:vi.fn()}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("not_found");},permanentRedirect:(path:string)=>{throw new Error("redirect:"+path);}}));
vi.mock("@/components/i18n/PublicHeader",()=>({PublicHeader:()=> <header/>}));
vi.mock("@/server/services/opportunity.service",()=>({PublicOpportunityService:class{list=mocks.list;},getPublicOpportunity:mocks.get,OpportunityService:class{list=mocks.adminList;},canManageOpportunities:(a:{allowed:boolean})=>a.allowed}));
vi.mock("@/server/services/access.service",()=>({getAdminAccess:mocks.access}));
vi.mock("@/server/actions/opportunity.actions",()=>({saveOpportunity:vi.fn(),changeOpportunityStatus:vi.fn()}));
import { PublicOpportunityCatalog,PublicOpportunityDetail,opportunityCatalogMetadata,opportunityDetailMetadata } from "./PublicOpportunities";
import { OpportunityAdminEditor,OpportunityAdminList } from "./OpportunityAdmin";
const record={id:"00000000-0000-4000-a000-000000000001",version:2,type:"grant",country:"KZ",deadline:"2000-11-01T13:00:00Z",sourceUrl:"https://example.org/grant",status:"published",publishedAt:"2000-01-01T00:00:00Z",translations:["ru","kk","en"].map(locale=>({locale,slug:"science-grant",title:"<script>Science</script>",summary:"A scientific research funding opportunity.",description:"<script>Private HTML cannot execute</script>",organization:"Science Foundation",funding:"Full funding"}))};
const props=(locale="ru",query={})=>({params:Promise.resolve({locale}),searchParams:Promise.resolve(query)});
const detail=(locale="ru",slug="science-grant")=>({params:Promise.resolve({locale,slug})});
beforeEach(()=>{vi.clearAllMocks();mocks.list.mockResolvedValue({total:1,page:1,pageSize:12,items:[record]});mocks.get.mockResolvedValue(record);mocks.access.mockResolvedValue({state:"allowed",access:{allowed:true}});mocks.adminList.mockResolvedValue({total:1,page:1,pageSize:12,items:[record]});});
it.each(["ru","kk","en"])("renders localized %s catalogue filters, links and escaped content",async locale=>{
  const html=renderToStaticMarkup(await PublicOpportunityCatalog(props(locale,{type:"grant",country:"kz",availability:"closed",page:"2"})));
  expect(html).toContain(`action="/${locale}/opportunities"`);expect(html).toContain(`href="/${locale}/opportunities/science-grant"`);expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>Science");expect(mocks.list).toHaveBeenCalledWith(locale,expect.objectContaining({country:"KZ",availability:"closed"}),2);
});
it("displays closed deadline and safe source and renders descriptions as plain text",async()=>{
  const html=renderToStaticMarkup(await PublicOpportunityDetail(detail("en")));expect(html).toContain("Applications closed");expect(html).toContain('rel="noreferrer"');expect(html).toContain("&lt;script&gt;Private HTML");expect(html).not.toContain("<script>Private");expect(html).toContain("Full funding");
});
it("redirects historical slugs, rejects invalid slugs/locales and returns 404 for absent translations",async()=>{
  await expect(PublicOpportunityDetail(detail("ru","old-grant"))).rejects.toThrow("redirect:/ru/opportunities/science-grant");
  mocks.get.mockClear();await expect(PublicOpportunityDetail(detail("ru","bad.slug"))).rejects.toThrow("not_found");await expect(PublicOpportunityCatalog(props("de"))).rejects.toThrow("not_found");expect(mocks.get).not.toHaveBeenCalled();
  mocks.get.mockResolvedValue({...record,translations:record.translations.filter(t=>t.locale!=="en")});await expect(PublicOpportunityDetail(detail("en"))).rejects.toThrow("not_found");
});
it("shows an unavailable state without leaking errors or pretending the queue is empty",async()=>{
  mocks.list.mockRejectedValue(new Error("SECRET database error"));const html=renderToStaticMarkup(await PublicOpportunityCatalog(props("en")));expect(html).toContain("Unable to load opportunities");expect(html).not.toContain("SECRET");expect(html).not.toContain("No opportunities found");
});
it("sets canonical, hreflang and noindex for alternate catalogue filters",async()=>{
  expect(await opportunityCatalogMetadata(props("kk",{availability:"closed"}))).toMatchObject({robots:{index:false,follow:true}});
  expect(await opportunityCatalogMetadata(props("ru",{availability:"all"}))).toMatchObject({robots:{index:false,follow:true}});
  expect(await opportunityCatalogMetadata(props("ru"))).toMatchObject({robots:{index:true,follow:true}});
  const meta=await opportunityDetailMetadata(detail("kk"));expect(meta).toMatchObject({title:record.translations[0].title,alternates:{canonical:expect.stringContaining("/kk/opportunities/science-grant"),languages:{ru:expect.stringContaining("/ru/opportunities/science-grant")}}});expect(JSON.stringify(meta)).not.toMatch(/sourceUrl|version/);
});
it("guards admin editors and lists, renders versioned workflow and no missing rows",async()=>{
  mocks.access.mockResolvedValueOnce({state:"allowed",access:{allowed:false}});await expect(OpportunityAdminList({searchParams:Promise.resolve({})})).rejects.toThrow("not_found");expect(mocks.adminList).not.toHaveBeenCalled();
  const html=renderToStaticMarkup(await OpportunityAdminEditor({id:record.id,searchParams:Promise.resolve({})}));expect(html).toContain("Опубликовано");expect(html).toContain("В архив");expect(html).toContain("Сохранить черновик");
  await expect(OpportunityAdminEditor({id:"bad",searchParams:Promise.resolve({})})).rejects.toThrow("not_found");
  mocks.adminList.mockResolvedValueOnce({items:[]});await expect(OpportunityAdminEditor({id:record.id,searchParams:Promise.resolve({})})).rejects.toThrow("not_found");
});
