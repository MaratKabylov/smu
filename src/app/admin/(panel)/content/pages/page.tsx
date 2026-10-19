import { SiteContentAdmin } from "@/components/content/SiteContentAdmin";

export default async function Pages({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  return <SiteContentAdmin mode="pages" selected={(await searchParams).key} />;
}
