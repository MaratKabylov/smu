import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({configured:vi.fn(),session:vi.fn(),public:vi.fn(),rpc:vi.fn(),publicRpc:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/env",()=>({isSupabaseConfigured:mocks.configured}));
vi.mock("@/lib/supabase/server",()=>({createServerSupabaseClient:mocks.session}));vi.mock("@/lib/supabase/public",()=>({createPublicSupabaseClient:mocks.public}));
import { OpportunityService,PublicOpportunityService } from "./opportunity.service";
import { opportunityFiltersSchema } from "@/lib/validation/opportunity";
import type { AccessContext } from "@/types/domain/auth";
const access:AccessContext={userId:"00000000-0000-4000-a000-000000000001",roles:new Set(),permissions:new Set(["admin.access","opportunities.manage"])};
const page={items:[],total:0,page:1,pageSize:12};const filters=opportunityFiltersSchema.parse({});
beforeEach(()=>{vi.clearAllMocks();mocks.configured.mockReturnValue(true);mocks.session.mockResolvedValue({rpc:mocks.rpc});mocks.public.mockReturnValue({rpc:mocks.publicRpc});mocks.rpc.mockResolvedValue({data:page,error:null});mocks.publicRpc.mockResolvedValue({data:page,error:null});});
it("reads public data exclusively with a fresh anonymous client and keeps details available after deadline",async()=>{
  await new PublicOpportunityService().list("kk",filters,2);expect(mocks.publicRpc).toHaveBeenCalledWith("list_opportunities",{p_locale:"kk",p_page:2,p_id:null,p_slug:null,p_manage:false,p_filters:filters});
  expect(await new PublicOpportunityService().get("en","science-grant")).toBeNull();expect(mocks.publicRpc).toHaveBeenLastCalledWith("list_opportunities",expect.objectContaining({p_manage:false,p_slug:"science-grant",p_filters:expect.objectContaining({availability:"all"})}));expect(mocks.session).not.toHaveBeenCalled();
});
it("requires both permissions before opening a session client",async()=>{
  for(const permissions of [new Set<"admin.access">(["admin.access"]),new Set<"opportunities.manage">(["opportunities.manage"]),new Set<never>()])await expect(new OpportunityService().list({...access,permissions},filters)).rejects.toThrow("forbidden");expect(mocks.session).not.toHaveBeenCalled();
  await new OpportunityService().list(access,filters);expect(mocks.rpc).toHaveBeenCalledWith("list_opportunities",expect.objectContaining({p_manage:true}));expect(mocks.public).not.toHaveBeenCalled();
});
it("uses session-bound status RPCs without actor or service-role authority",async()=>{
  await new OpportunityService().changeStatus(access,access.userId,3,"archived");expect(mocks.rpc).toHaveBeenCalledWith("change_opportunity_status",{p_id:access.userId,p_version:3,p_status:"archived"});
  mocks.rpc.mockResolvedValueOnce({data:null,error:{message:"stale_version"}});await expect(new OpportunityService().changeStatus(access,access.userId,1,"published")).rejects.toEqual({message:"stale_version"});
});
it("validates database projections and returns empty data only when Supabase is unconfigured",async()=>{
  mocks.publicRpc.mockResolvedValueOnce({data:{...page,items:[{id:"bad"}]},error:null});await expect(new PublicOpportunityService().list("ru",filters)).rejects.toThrow();
  mocks.configured.mockReturnValue(false);expect(await new PublicOpportunityService().list("ru",filters)).toEqual(page);expect(await new PublicOpportunityService().get("ru","science-grant")).toBeNull();
});
