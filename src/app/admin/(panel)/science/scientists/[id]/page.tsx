import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScientistForm } from "@/components/scientists/ScientistForm";
import { canEditScientist, canVerifyScientist, canViewMedia, canManageUsers, hasPermission } from "@/lib/permissions/permissions";
import { verificationLabels, verificationStatuses } from "@/lib/scientists/profile";
import { changeScientistVerification, linkScientistAccount, softDeleteScientist, updateScientist } from "@/server/actions/scientist.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { MediaService } from "@/server/services/media.service";
import { ScientistService } from "@/server/services/scientist.service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; status_changed?: string; account_linked?: string; merged?: string; error?: string }>;
};

const errors: Record<string, string> = {
  validation: "Проверьте обязательные поля, ссылки, ORCID и формат slug.",
  forbidden: "Недостаточно прав для этого действия.",
  invalid_reference: "Связанные данные недоступны или аккаунт уже привязан к другому профилю.",
  invalid_transition: "Это изменение статуса недоступно.",
  confirm_delete: "Подтвердите перенос профиля в удалённые.",
  action_failed: "Не удалось сохранить изменения. Проверьте уникальность slug.",
  invalid_input: "Проверьте обязательные поля профиля.",
  stale_version: "Профиль уже изменился. Обновите страницу перед повторным действием.",
  slug_conflict: "Этот slug уже используется. Выберите другой адрес.",
  slug_reserved: "Этот адрес принадлежит другому профилю и сохранён в истории ссылок.",
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
  const account = profile.userId && canManageUsers(result.access) ? await service.linkedAccount(result.access, id) : null;

  return <div className="content-page">
    <Link className="back-link" href="/admin/science/scientists"><ArrowLeft aria-hidden="true" />Назад к учёным</Link>
    <div className="media-detail-heading article-detail-heading">
      <div><p className="page-kicker">Профиль учёного</p><h1>{ru?.fullName ?? "Учёный"}</h1><p>{ru?.position ?? "Должность не указана"} · {profile.organization?.nameRu ?? "Организация не указана"}</p></div>
      <span className={`status-badge status-${profile.status}`}>{verificationLabels[profile.verificationStatus]} · {profile.isPublic ? "Публичный" : "Закрытый"}</span>
    </div>
    {state.created === "1" ? <div className="notice success-notice">Черновик профиля создан.</div> : null}
    {state.saved === "1" ? <div className="notice success-notice">Изменения сохранены. После правок профиль имеет статус черновика.</div> : null}
    {state.account_linked === "1" ? <div className="notice success-notice">Привязка аккаунта обновлена.</div> : null}
    {state.merged === "1" ? <div className="notice success-notice">Профили объединены. Проверьте итоговые данные и повторно верифицируйте профиль и связанные статьи.</div> : null}
    {state.status_changed === "1" ? <div className="notice success-notice">Статус профиля обновлён.</div> : null}
    {state.error ? <div className="notice error-notice" role="alert">{errors[state.error] ?? errors.action_failed}</div> : null}

    <section className="workflow-panel">
      <div><p className="page-kicker">Верификация</p><h2>{verificationLabels[profile.verificationStatus]}</h2><p>Проверка подтверждает данные профиля. Для публикации также должна быть включена публичность; редактирование снимает верификацию.</p>{profile.verificationNote ? <p>{profile.verificationNote}</p> : null}</div>
      {mayVerify ? <form action={changeScientistVerification.bind(null, profile.id)} className="translation-fields">
        <input type="hidden" name="expectedVersion" value={profile.contentVersion} />
        <label>Решение<select name="status" defaultValue={profile.verificationStatus === "verified" ? "unverified" : profile.verificationStatus === "pending" ? "verified" : "pending"}>{verificationStatuses.filter(status => status !== profile.verificationStatus).map(status => <option key={status} value={status}>{verificationLabels[status]}</option>)}</select></label>
        <label>Комментарий (для отклонения — от 10 символов)<textarea name="note" maxLength={2000} rows={3} /></label>
        <button className="primary-button" type="submit">Сохранить решение</button>
      </form> : null}
    </section>
    {canManageUsers(result.access) ? <section className="article-editor-panel">
      <h2>Связь с аккаунтом</h2><p>{account ? "Текущий аккаунт: " + (account.display_name ?? "Пользователь") + " · " + account.email : "Профиль пока не связан с аккаунтом."} Привязка не назначает роли и права администратора.</p>
      <form action={linkScientistAccount.bind(null, profile.id)} className="translation-fields">
        <input type="hidden" name="expectedVersion" value={profile.contentVersion} />
        <label>Email зарегистрированного аккаунта<input type="email" name="email" maxLength={254} placeholder="name@example.kz" /></label>
        <p className="field-hint">Пустое поле снимает текущую привязку. Аккаунт может быть связан только с одним научным профилем.</p>
        <label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required />Подтверждаю изменение владельца</label>
        <button className="secondary-button" type="submit">Обновить привязку</button>
      </form>
    </section> : null}
    {hasPermission(result.access, "scientists.merge") ? <section className="article-editor-panel"><h2>Дубликат профиля</h2><p>Перенесите связи этого профиля в выбранный основной профиль.</p><Link className="secondary-button" href={"/admin/science/scientists/" + profile.id + "/merge"}>Объединить с другим профилем</Link></section> : null}

    <ScientistForm action={updateAction} profile={profile} taxonomy={taxonomy} media={media} />

    <section className="danger-zone">
      <div><h2>Перенести в удалённые</h2><p>Профиль исчезнет из админского списка и публичного каталога.</p></div>
      <form action={deleteAction}><label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required />Подтверждаю действие</label><button className="danger-button" type="submit"><Trash2 aria-hidden="true" />Удалить</button></form>
    </section>
  </div>;
}
