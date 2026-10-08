import { revalidatePath, revalidateTag } from "next/cache";
import { publicContentTag } from "@/lib/supabase/public-cache";
import { locales, localizedPath, publicSections } from "./locales";

export function invalidatePublicContent() {
  // Expire immediately in Actions and cron: withdrawn content cannot be stale.
  revalidateTag(publicContentTag, { expire: 0 });
}

export function revalidateLocalizedPath(path: string, type?: "page" | "layout") {
  invalidatePublicContent();
  if (publicSections.some(section => path === `/${section}`)) {
    for (const locale of locales) revalidatePath(localizedPath(locale, path), type ?? "layout");
  } else {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  }
}
