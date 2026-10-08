import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { canEditScientist, canManageUsers, hasPermission } from "@/lib/permissions/permissions";
import { verificationLabels } from "@/lib/scientists/profile";
import { scientistListFiltersSchema } from "@/lib/validation/scientist";
import { mergeScientistProfiles } from "@/server/actions/scientist.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { ScientistService } from "@/server/services/scientist.service";
import type { ScientistProfile } from "@/types/domain/scientist";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; target?: string; error?: string }> };
const name = (profile: ScientistProfile) => (profile.translations.find(t => t.locale === "ru") ?? profile.translations[0])?.fullName ?? "Без имени";
const errors: Record<string, string> = {
  stale_version: "Один из профилей изменился. Проверьте данные на обновлённой странице и повторите действие.",
  forbidden: "Для переноса привязанного аккаунта требуется право управления пользователями.",
  invalid_reference: "Профили имеют разные аккаунты, ORCID или ссылки одного типа. Сначала проверьте и устраните расхождения.",
  invalid_input: "Проверьте причину и выбранные профили. Общее число направлений не должно превышать 20.",
  not_found: "Один из профилей уже удалён или объединён.",
};
export default async function MergeScientistPage({ params, searchParams }: Props) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canEditScientist(result.access) || !hasPermission(result.access, "scientists.merge")) notFound();
  const [{ id }, state] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const service = new ScientistService();
  const source = await service.getById(result.access, id);
  if (!source || source.deletedAt) notFound();
  const path = "/admin/science/scientists/" + id + "/merge";
  const parsed = scientistListFiltersSchema.safeParse({ query: state.q ?? "", status: "all" });
  const candidates = parsed.success ? (await service.list(result.access, parsed.data)).filter(p => p.id !== id) : [];
  const target = state.target && z.uuid().safeParse(state.target).success ? await service.getById(result.access, state.target) : null;
  const selected = target && !target.deletedAt && target.id !== id ? target : null;
  const mayTransfer = !source.userId || canManageUsers(result.access);
  return <div className="content-page">
    <Link className="back-link" href={"/admin/science/scientists/" + id}>Назад к профилю</Link>
    <div className="page-heading"><div><p className="page-kicker">Дубликаты</p><h1>Объединение профилей</h1><p>Перенос из профиля «{name(source)}» в основной профиль.</p></div></div>
    {state.error ? <div className="notice error-notice" role="alert">{errors[state.error] ?? "Объединение не выполнено. Проверьте данные и подтверждение."}</div> : null}
    <section className="article-editor-panel"><h2>Найти основной профиль</h2><form action={path} className="media-filters"><label>Имя учёного<input name="q" type="search" maxLength={120} defaultValue={state.q ?? ""} /></label><button type="submit" className="secondary-button">Найти</button></form>
      <ul>{candidates.map(profile => <li key={profile.id}><Link href={path + "?target=" + profile.id}>{name(profile)}</Link> · {verificationLabels[profile.verificationStatus]} · {profile.isPublic ? "публичный" : "закрытый"}</li>)}</ul>
      {!candidates.length ? <p>Другие профили не найдены.</p> : null}
    </section>
    {selected ? <section className="article-editor-panel"><h2>Основной профиль: {name(selected)}</h2>
      <p>Его имя, переводы, биография, фотография и настройки сотрудничества сохранятся. Направления и научные ссылки будут объединены. Исследования, проекты, научные публикации, программы, предложения наставничества и ссылки из статей перейдут к основному профилю.</p>
      <p>Исходный профиль будет помечен как объединённый; его содержимое останется в закрытой истории. Его старые адреса откроют основной профиль после повторной верификации. Итоговый профиль останется закрытым, если хотя бы один из двух был закрытым.</p>
      <p>Итоговый профиль и затронутые редакционные статьи потребуют повторной проверки. Статьи вернутся в черновики, запланированная публикация отменится. Разные аккаунты, ORCID и ссылки одного типа требуют предварительного исправления.</p>
      {!mayTransfer ? <div className="notice error-notice">Исходный профиль связан с аккаунтом. Для его переноса требуется право управления пользователями.</div> : null}
      <form action={mergeScientistProfiles.bind(null, id)} className="translation-fields">
        <input type="hidden" name="targetId" value={selected.id} /><input type="hidden" name="sourceVersion" value={source.contentVersion} /><input type="hidden" name="targetVersion" value={selected.contentVersion} />
        <label>Основание объединения<textarea name="reason" minLength={10} maxLength={2000} rows={4} required /></label>
        <label className="confirm-check"><input type="checkbox" name="confirm" value="yes" required />Подтверждаю, что оба профиля принадлежат одному учёному</label>
        <button className="danger-button" type="submit" disabled={!mayTransfer}>Объединить в «{name(selected)}»</button>
      </form>
    </section> : null}
  </div>;
}
