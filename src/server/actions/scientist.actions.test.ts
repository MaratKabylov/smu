import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access:vi.fn(), update:vi.fn(), verification:vi.fn(), link:vi.fn(), merge:vi.fn(), taxonomy:vi.fn(), path:vi.fn(), tag:vi.fn() }));
vi.mock("next/cache", () => ({revalidatePath:mocks.path,revalidateTag:mocks.tag}));
vi.mock("next/navigation", () => ({redirect:(path:string) => {throw new Error("redirect:" + path);}}));
vi.mock("@/server/services/access.service", () => ({getAdminAccess:mocks.access}));
vi.mock("@/server/services/scientist.service", () => ({
  ScientistService:class {update=mocks.update;changeVerification=mocks.verification;linkAccount=mocks.link;merge=mocks.merge;updateTaxonomyItem=mocks.taxonomy;},
  ScientistServiceError:class extends Error {constructor(public code:string,message:string){super(message);}},
}));
import { changeScientistVerification, linkScientistAccount, mergeScientistProfiles, updateScientist, updateScientistTaxonomy } from "./scientist.actions";
import { ScientistServiceError } from "@/server/services/scientist.service";
const source="00000000-0000-4000-a000-000000000010";
const target="00000000-0000-4000-a000-000000000011";
const form = (values:Record<string,string>) => {const data=new FormData();for(const [key,value] of Object.entries(values)) data.set(key,value);return data;};
const verification = () => form({status:"pending",expectedVersion:"4",note:""});
const account = () => form({email:"user@example.kz",expectedVersion:"4",confirm:"yes"});
const merge = () => form({targetId:target,sourceVersion:"4",targetVersion:"6",reason:"Confirmed duplicate identity.",confirm:"yes"});
beforeEach(() => {vi.clearAllMocks();mocks.access.mockResolvedValue({state:"allowed",access:{userId:source}});});
describe("extended scientist server actions", () => {
  it("passes verification/account/merge versions and immediately expires the public dependency tag on success", async () => {
    await expect(changeScientistVerification(source,verification())).rejects.toThrow("status_changed=1");
    expect(mocks.verification).toHaveBeenCalledWith({userId:source},source,{status:"pending",expectedVersion:4,note:""});
    await expect(linkScientistAccount(source,account())).rejects.toThrow("account_linked=1");
    expect(mocks.link).toHaveBeenCalledWith({userId:source},source,{email:"user@example.kz",expectedVersion:4});
    await expect(mergeScientistProfiles(source,merge())).rejects.toThrow("redirect:/admin/science/scientists/" + target + "?merged=1");
    expect(mocks.merge).toHaveBeenCalledWith({userId:source},{sourceId:source,targetId:target,sourceVersion:4,targetVersion:6,reason:"Confirmed duplicate identity."});
    expect(mocks.tag).toHaveBeenCalledWith("smu:public-content:v1",{expire:0});
    for(const locale of ["ru","kk","en"]) expect(mocks.path).toHaveBeenCalledWith("/" + locale + "/scientists","layout");
    expect(mocks.path).toHaveBeenCalledWith("/admin/content/articles");
  });
  it("requires versions, complete rejection feedback and explicit confirmation before writes", async () => {
    const missing=verification();missing.delete("expectedVersion"); await expect(changeScientistVerification(source,missing)).rejects.toThrow("error=validation");
    const rejected=verification();rejected.set("status","rejected"); await expect(changeScientistVerification(source,rejected)).rejects.toThrow("error=validation");
    const unconfirmed=merge();unconfirmed.delete("confirm"); await expect(mergeScientistProfiles(source,unconfirmed)).rejects.toThrow("error=validation");
    const self=merge();self.set("targetId",source); await expect(mergeScientistProfiles(source,self)).rejects.toThrow("error=validation");
    expect(mocks.access).not.toHaveBeenCalled();expect(mocks.merge).not.toHaveBeenCalled();expect(mocks.tag).not.toHaveBeenCalled();
  });
  it("does not invalidate caches on unauthorized sessions or stale/database failures", async () => {
    mocks.access.mockResolvedValueOnce({state:"unauthenticated"}); await expect(changeScientistVerification(source,verification())).rejects.toThrow("redirect:/admin/login");
    mocks.link.mockRejectedValueOnce(new ScientistServiceError("stale_version","Stale")); await expect(linkScientistAccount(source,account())).rejects.toThrow("error=stale_version");
    mocks.merge.mockRejectedValueOnce(new Error("internal database details")); await expect(mergeScientistProfiles(source,merge())).rejects.toThrow("error=action_failed");
    expect(mocks.tag).not.toHaveBeenCalled();expect(mocks.path).not.toHaveBeenCalled();
  });
  it("parses typed links, checkbox visibility and collaboration while requiring the opened edit version", async () => {
    const data=form({organizationId:"",avatarMediaId:"",publicEmail:"",expectedContentVersion:"4",link_website:"https://example.kz",collaboration_mentoring:"yes"});
    for(const suffix of ["Ru","Kk"]) for(const [key,value] of Object.entries({fullName:"Regional Scientist",slug:"scientist",position:"Researcher",academicDegree:"",shortBio:"Regional scientific research overview.",biography:"A detailed description of scientific projects and regional research."})) data.set(key+suffix,value);
    await expect(updateScientist(source,data)).rejects.toThrow("saved=1");
    expect(mocks.update).toHaveBeenCalledWith({userId:source},source,expect.objectContaining({expectedContentVersion:4,isPublic:false,links:[{type:"website",url:"https://example.kz"}],collaboration:expect.objectContaining({mentoring:true})}));
    vi.clearAllMocks();data.delete("expectedContentVersion");await expect(updateScientist(source,data)).rejects.toThrow("error=validation");expect(mocks.update).not.toHaveBeenCalled();expect(mocks.tag).not.toHaveBeenCalled();
  });
});

describe("scientist directory actions", () => {
  it("parses hierarchy, active state and exact version before updating", async () => {
    const data=form({kind:"field",slug:"earth-sciences",nameRu:"Науки о Земле",nameKk:"Жер туралы ғылымдар",nameEn:"Earth sciences",parentId:target,isActive:"yes",expectedUpdatedAt:"2026-10-09T12:00:00.000Z"});
    await expect(updateScientistTaxonomy(source,data)).rejects.toThrow("saved=1");
    expect(mocks.taxonomy).toHaveBeenCalledWith({userId:source},source,expect.objectContaining({kind:"field",parentId:target,isActive:true,expectedUpdatedAt:"2026-10-09T12:00:00.000Z"}));
    expect(mocks.tag).toHaveBeenCalledWith("smu:public-content:v1",{expire:0});
  });
  it("rejects a missing version or unknown organization type before authentication", async () => {
    const missing=form({kind:"field",slug:"earth-sciences",nameRu:"Науки о Земле",nameKk:"Жер туралы ғылымдар",parentId:"",isActive:"yes"});
    await expect(updateScientistTaxonomy(source,missing)).rejects.toThrow("error=validation");
    const bad=form({kind:"organization",slug:"lab",nameRu:"Лаборатория",nameKk:"Зертхана",organizationType:"unknown",websiteUrl:"",expectedUpdatedAt:"2026-10-09T12:00:00.000Z",isActive:"yes"});
    await expect(updateScientistTaxonomy(source,bad)).rejects.toThrow("error=validation");
    expect(mocks.taxonomy).not.toHaveBeenCalled();
  });
});
