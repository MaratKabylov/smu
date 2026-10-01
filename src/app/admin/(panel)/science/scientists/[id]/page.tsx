import { ArrowLeft, BadgeCheck, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScientistForm } from "@/components/scientists/ScientistForm";
import { canEditScientist, canVerifyScientist, canViewMedia } from "@/lib/permissions/permissions";
import { scientistStatusLabels } from "@/lib/scientists/presentation";
import { changeScientistStatus, softDeleteScientist, updateScientist } from "@/server/actions/scientist.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { MediaService } from "@/server/services/media.service";
import { ScientistService } from "@/server/services/scientist.service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; status_changed?: string; error?: string }>;
};

const errors: Record<string, string> = {
  validation: "Проверьте обязательные поля, ссылки, ORCID и формат slug.",
  forbidden: "Недостаточно прав для этого действия.",
  invalid_reference: "Выбранная организация, направление или фотография недоступны.",
  invalid_transition: "Это изменение статуса недоступно.",
  confirm_delete: "Подтвердите перенос профиля в удалённые.",
  action_failed: "Не удалось сохранить изменения. Проверьте уникальность slug.",
};

export default async function ScientistDetailPage({ params, searchParams }: Props) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canEditScientist(result.access)) notFound();
  const [{ id }, state] = await Promise.all([params, searchParams]);
  const service = new ScientistService();
  const profile = await service.getById(result.access, id);
  if (!profile || profile.deletedAt) notFound();
  const [taxonomy, initialMedia] = await Promise.all([
    service.listTaxonomy(result.access),
    canViewMedia(result.access)
      ? new MediaService().list(result.access, { query: "", type: "image" }).then((items) => items.filter((item) => item.storageBucket === "avatars"))
      : Promise.resolve([]),
  ]);
  const media = [...initialMedia];
  if (profile.avatarMediaId && canViewMedia(result.access) && !media.some((item) => item.id === profile.avatarMediaId)) {
    const current = await new MediaService().getById(result.access, profile.avatarMediaId);
    if (current && !current.asset.deletedAt) media.push(current.asset);
  }
  const ru = profile.translations.find((item) => item.locale === "ru");
  const updateAction = updateScientist.bind(null, profile.id);
  const deleteAction = softDeleteScientist.bind(null, profile.id);
  const mayVerify = canVerifyScientist(result.access);

  return <div className="content-page">
    <Link className="back-link" href="/admin/science/scientists"><ArrowLeft aria-hidden="true" />Назад к учёным</Link>
    <div className="media-detail-heading article-detail-heading">
      <div><p className="page-kicker">Профиль учёного</p><h1>{ru?.fullName ?? "Учёный"}</h1><p>{ru?.position ?? "Должность не указана"} · {profile.organization?.nameRu ?? "Организация не указана"}</p></div>
      <span className={`status-badge status-${profile.status}`}>{scientistStatusLabels[profile.status]}</span>
    </div>
    {state.created === "1" ? <div className="notice success-notice">Черновик профиля создан.</div> : null}
    {state.saved === "1" ? <div className="notice success-notice">Изменения сохранены. После правок профиль имеет статус черновика.</div> : null}
    {state.status_changed === "1" ? <div className="notice success-notice">Статус профиля обновлён.</div> : null}
    {state.error ? <div className="notice error-notice" role="alert">{errors[state.error] ?? errors.action_failed}</div> : null}

    <section className="workflow-panel">
      <div><p className="page-kicker">Публикация в каталоге</p><h2>{scientistStatusLabels[profile.status]}</h2><p>Верификация делает профиль доступным на публичном сайте. Любое последующее редактирование возвращает его в черновики.</p></div>
      {mayVerify ? <div className="workflow-actions">
        {profile.status === "draft" ? <form action={changeScientistStatus.bind(null, profile.id, "verified")}><button className="primary-button" type="submit"><BadgeCheck aria-hidden="true" />Верифицировать</button></form> : <form action={changeScientistStatus.bind(null, profile.id, "draft")}><button className="secondary-button" type="submit"><RotateCcw aria-hidden="true" />Вернуть в черновики</button></form>}
      </div> : null}
    </section>

    <ScientistForm action={updateAction} profile={profile} taxonomy={taxonomy} media={media} />

    <section className="danger-zone">
      <div><h2>Перенести в удалённые</h2><p>Профиль исчезнет из админского списка и публичного каталога.</p></div>
      <form action={deleteAction}><label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required />Подтверждаю действие</label><button className="danger-button" type="submit"><Trash2 aria-hidden="true" />Удалить</button></form>
    </section>
  </div>;
}
