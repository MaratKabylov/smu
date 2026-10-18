import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),save:vi.fn(),change:vi.fn(),invalidate:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error("redirect:"+url);}}));
vi.mock("@/server/services/access.service",()=>({getAdminAccess:mocks.access}));
vi.mock("@/server/services/opportunity.service",()=>({OpportunityService:class{save=mocks.save;changeStatus=mocks.change;}}));
vi.mock("@/lib/i18n/revalidation",()=>({revalidateLocalizedPath:mocks.invalidate}));
import { changeOpportunityStatus, saveOpportunity } from "./opportunity.actions";
const id="00000000-0000-4000-a000-000000000001",access={userId:id,permissions:new Set(["admin.access","opportunities.manage"])};
function form(){const f=new FormData();f.set("type","grant");f.set("country","kz");f.set("deadline","2026-11-01T18:30");f.set("sourceUrl","https://example.org/grant");for(const locale of ["ru","kk"]){for(const [key,value] of Object.entries({title:"Science grant",slug:"science-grant",summary:"Funding for regional scientific research.",description:"Open applications for a regional scientific research grant.",organization:"Foundation",funding:""}))f.set(key+"_"+locale,value);}return f;}
beforeEach(()=>{vi.clearAllMocks();mocks.access.mockResolvedValue({state:"allowed",access});mocks.save.mockResolvedValue(id);mocks.change.mockResolvedValue(undefined);});
it("requires current admin access before parsing and mutation",async()=>{
  mocks.access.mockResolvedValue({state:"unauthenticated"});await expect(saveOpportunity(null,null,{},form())).rejects.toThrow("redirect:/admin/login");
  await expect(changeOpportunityStatus(id,1,"published")).rejects.toThrow("redirect:/admin/login");expect(mocks.save).not.toHaveBeenCalled();expect(mocks.change).not.toHaveBeenCalled();
  mocks.access.mockResolvedValue({state:"forbidden"});await expect(saveOpportunity(null,null,{},form())).rejects.toThrow("redirect:/admin");
});
it("normalizes country and Aktobe wall-clock deadline, ignores forged actors/status and refreshes connected pages",async()=>{
  const f=form();f.set("actor","FORGED");f.set("status","published");await expect(saveOpportunity(null,null,{},f)).rejects.toThrow("redirect:/admin/opportunities/"+id+"?saved=1");
  expect(mocks.save).toHaveBeenCalledWith(access,expect.objectContaining({id:null,version:null,country:"KZ",deadline:"2026-11-01T13:30:00.000Z"}));
  const data=mocks.save.mock.calls[0][1];expect(data).not.toHaveProperty("actor");expect(data).not.toHaveProperty("status");expect(data.translations).toHaveLength(2);
  expect(mocks.invalidate.mock.calls).toEqual([["/admin/opportunities","layout"],["/opportunities","layout"],["/search","layout"]]);
});
it("rejects invalid dates, missing RU/KK, incomplete English, invalid version and unsafe URLs before RPC",async()=>{
  for(const [key,value] of [["deadline","2026-02-30T10:00"],["title_kk",""],["title_en","Partial English"],["sourceUrl","javascript:alert(1)"]]){const f=form();f.set(key,value);expect(await saveOpportunity(null,null,{},f)).toEqual({error:"validation"});}
  expect(await saveOpportunity(id,null,{},form())).toEqual({error:"validation"});expect(mocks.save).not.toHaveBeenCalled();
});
it("accepts no deadline and preserves complete optional English",async()=>{
  const f=form();f.set("deadline","");for(const [key,value] of [...f.entries()])if(key.endsWith("_ru"))f.set(key.replace("_ru","_en"),value);
  await expect(saveOpportunity(id,2,{},f)).rejects.toThrow("redirect:");expect(mocks.save).toHaveBeenCalledWith(access,expect.objectContaining({id,version:2,deadline:null,translations:expect.arrayContaining([expect.objectContaining({locale:"en"})])}));
});
it("returns safe retry errors and never invalidates failed writes",async()=>{
  for(const [error,code] of [[{message:"stale_version"},"stale_version"],[{message:"slug_reserved"},"slug_reserved"],[{message:"SECRET private@example.org"},"action_failed"]] as const){mocks.save.mockRejectedValueOnce(error);expect(await saveOpportunity(null,null,{},form())).toEqual({error:code});}
  expect(mocks.invalidate).not.toHaveBeenCalled();
});
it("validates status commands and forwards the expected version, mapping stale errors safely",async()=>{
  await expect(changeOpportunityStatus("bad",1,"published")).rejects.toThrow("redirect:/admin/opportunities?error=validation");expect(mocks.change).not.toHaveBeenCalled();
  mocks.change.mockRejectedValueOnce({message:"stale_version"});await expect(changeOpportunityStatus(id,2,"archived")).rejects.toThrow("?error=stale_version");expect(mocks.invalidate).not.toHaveBeenCalled();
  await expect(changeOpportunityStatus(id,3,"draft")).rejects.toThrow("?saved=1");expect(mocks.change).toHaveBeenLastCalledWith(access,id,3,"draft");
});
