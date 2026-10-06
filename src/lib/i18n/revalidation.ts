import { revalidatePath } from "next/cache";
import { locales, localizedPath, publicSections } from "./locales";

export function revalidateLocalizedPath(path: string, type?: "page" | "layout") {
  if (publicSections.some(section => path === `/${section}`)) {
    for (const locale of locales) revalidatePath(localizedPath(locale, path), type ?? "layout");
  } else {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  }
}
