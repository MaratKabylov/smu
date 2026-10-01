import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScientistForm } from "@/components/scientists/ScientistForm";
import { canEditScientist, canViewMedia } from "@/lib/permissions/permissions";
import { createScientist } from "@/server/actions/scientist.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { MediaService } from "@/server/services/media.service";
import { ScientistService } from "@/server/services/scientist.service";

export default async function NewScientistPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canEditScientist(result.access)) notFound();
  const [taxonomy, media, state] = await Promise.all([
    new ScientistService().listTaxonomy(result.access),
    canViewMedia(result.access)
      ? new MediaService().list(result.access, { query: "", type: "image" }).then((items) => items.filter((item) => item.storageBucket === "avatars"))
      : Promise.resolve([]),
    searchParams,
  ]);
  return <div className="content-page">
    <Link className="back-link" href="/admin/science/scientists"><ArrowLeft aria-hidden="true" />Назад к учёным</Link>
    <div className="media-detail-heading"><div><p className="page-kicker">Новый профиль</p><h1>Добавить учёного</h1><p>Профиль сохранится как черновик и потребует верификации.</p></div></div>
    {state.error ? <div className="notice error-notice" role="alert">{state.error === "validation" ? "Проверьте обязательные поля, ссылки, ORCID и формат slug." : "Не удалось создать профиль. Проверьте уникальность slug."}</div> : null}
    <ScientistForm action={createScientist} taxonomy={taxonomy} media={media} submitLabel="Создать черновик" />
  </div>;
}
