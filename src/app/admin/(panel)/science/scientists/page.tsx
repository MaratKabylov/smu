import { Plus, Search, Tags, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditScientist } from "@/lib/permissions/permissions";
import { scientistStatusLabels } from "@/lib/scientists/presentation";
import { scientistListFiltersSchema } from "@/lib/validation/scientist";
import { getAdminAccess } from "@/server/services/access.service";
import { ScientistService } from "@/server/services/scientist.service";
import { scientistStatuses } from "@/types/domain/scientist";

type Props = { searchParams: Promise<{ q?: string; status?: string; deleted?: string }> };
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });

export default async function ScientistsAdminPage({ searchParams }: Props) {
  const accessResult = await getAdminAccess();
  if (accessResult.state !== "allowed") return null;
  if (!canEditScientist(accessResult.access)) notFound();
  const params = await searchParams;
  const parsed = scientistListFiltersSchema.safeParse({ query: params.q ?? "", status: params.status ?? "all" });
  const filters = parsed.success ? parsed.data : { query: "", status: "all" as const };
  const profiles = await new ScientistService().list(accessResult.access, filters);

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки"><span>Наука</span><span>/</span><strong>Учёные</strong></nav>
      <div className="page-heading media-page-heading">
        <div><p className="page-kicker">Научное сообщество</p><h1>Учёные</h1><p>Двуязычные профили и публичный каталог исследователей региона.</p></div>
        <div className="heading-actions">
          <Link className="secondary-button" href="/admin/science/scientists/taxonomy"><Tags aria-hidden="true" />Справочники</Link>
          <Link className="primary-button" href="/admin/science/scientists/new"><Plus aria-hidden="true" />Добавить учёного</Link>
        </div>
      </div>
      {params.deleted === "1" ? <div className="notice success-notice">Профиль перенесён в удалённые.</div> : null}
      <section className="media-toolbar" aria-label="Фильтры профилей">
        <form className="media-filters" action="/admin/science/scientists">
          <label className="search-field"><Search aria-hidden="true" /><span className="visually-hidden">Поиск по имени</span><input type="search" name="q" defaultValue={filters.query} placeholder="Найти по имени" /></label>
          <label><span className="visually-hidden">Статус</span><select name="status" defaultValue={filters.status}><option value="all">Все статусы</option>{scientistStatuses.map((status) => <option value={status} key={status}>{scientistStatusLabels[status]}</option>)}</select></label>
          <button className="secondary-button" type="submit">Применить</button>
        </form>
        <span className="real-count">{profiles.length} профилей</span>
      </section>
      <section className="data-panel" aria-labelledby="scientists-table-title">
        <div className="data-panel-header"><div><h2 id="scientists-table-title">Каталог профилей</h2><p>Публично отображаются только верифицированные записи.</p></div></div>
        {profiles.length ? (
          <div className="table-wrap"><table className="articles-table"><thead><tr><th>Учёный</th><th>Организация</th><th>Направления</th><th>Статус</th><th>Обновлено</th></tr></thead><tbody>
            {profiles.map((profile) => {
              const ru = profile.translations.find((item) => item.locale === "ru") ?? profile.translations[0];
              return <tr key={profile.id}><td><Link href={`/admin/science/scientists/${profile.id}`}>{ru?.fullName ?? "Без имени"}</Link><small>{ru?.position ?? "—"}</small></td><td>{profile.organization?.nameRu ?? "—"}</td><td>{profile.fields.map((item) => item.nameRu).join(", ") || "—"}</td><td><span className={`status-badge status-${profile.status}`}>{scientistStatusLabels[profile.status]}</span></td><td>{dateFormatter.format(new Date(profile.updatedAt))}</td></tr>;
            })}
          </tbody></table></div>
        ) : <div className="empty-state"><span className="empty-icon"><UsersRound aria-hidden="true" /></span><h3>{filters.query ? "Ничего не найдено" : "Профилей пока нет"}</h3><p>Добавьте первый двуязычный профиль учёного.</p></div>}
      </section>
    </div>
  );
}
