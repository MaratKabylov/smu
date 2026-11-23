import { redirect } from "next/navigation";
import { z } from "zod";
import { ResearchOutputAdminList } from "@/components/science/ResearchOutputAdmin";

type SearchParams = Promise<{
  edit?: string;
  saved?: string;
  created?: string;
  error?: string;
  q?: string;
  status?: string;
  kind?: string;
}>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await searchParams;
  if (state.edit && z.uuid().safeParse(state.edit).success) {
    const params = new URLSearchParams();
    if (state.saved) params.set("saved", state.saved);
    if (state.created) params.set("created", state.created);
    if (state.error) params.set("error", state.error);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    redirect(`/admin/science/results/${state.edit}${queryString}`);
  }

  return <ResearchOutputAdminList searchParams={searchParams} />;
}
