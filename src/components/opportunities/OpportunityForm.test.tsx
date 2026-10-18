// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { OpportunityForm } from "./OpportunityForm";
import type { Opportunity } from "@/lib/validation/opportunity";
const record:Opportunity={id:"00000000-0000-4000-a000-000000000001",version:1,type:"grant",country:"KZ",deadline:null,sourceUrl:"https://example.org/grant",status:"draft",publishedAt:null,translations:["ru","kk"].map(locale=>({locale:locale as "ru"|"kk",slug:"science-grant",title:"Science grant",summary:"Funding for regional scientific research.",description:"Applications for scientific research funding are open now.",organization:"Foundation",funding:""}))};
let container:HTMLDivElement,root:Root;
beforeEach(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
it("blocks duplicate submission while pending and preserves edited fields after a safe failure",async()=>{
  let finish!:(value:{error?:string})=>void;const action=vi.fn().mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  await act(async()=>root.render(<OpportunityForm action={action} opportunity={record}/>));
  const title=container.querySelector<HTMLInputElement>('[name="title_ru"]')!;title.value="Edited grant";
  await act(async()=>container.querySelector("form")!.requestSubmit());expect(action).toHaveBeenCalledOnce();expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);expect(container.querySelector<HTMLFieldSetElement>("fieldset")!.disabled).toBe(true);
  await act(async()=>finish({error:"stale_version"}));expect(container.querySelector('[role="alert"]')?.textContent).toContain("уже изменена");expect(container.querySelector<HTMLButtonElement>("button")!.disabled).toBe(false);expect(title.value).toBe("Edited grant");
});
it("requires both language versions and a source while keeping English and deadlines optional",async()=>{
  await act(async()=>root.render(<OpportunityForm action={vi.fn()} opportunity={record}/>));
  expect(container.querySelector<HTMLInputElement>('[name="title_kk"]')!.required).toBe(true);expect(container.querySelector<HTMLInputElement>('[name="title_en"]')!.required).toBe(false);expect(container.querySelector<HTMLInputElement>('[name="deadline"]')!.required).toBe(false);
  expect(container.querySelector("form")!.checkValidity()).toBe(true);container.querySelector<HTMLInputElement>('[name="sourceUrl"]')!.value="";expect(container.querySelector("form")!.checkValidity()).toBe(false);
});
