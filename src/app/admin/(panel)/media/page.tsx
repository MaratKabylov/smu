import { redirect } from "next/navigation";

export default function LegacyMediaPage() {
  redirect("/admin/content/media");
}
