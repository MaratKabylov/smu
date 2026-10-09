import { ArrowLeft, Building2, FlaskConical, Plus, Save } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditScientist } from "@/lib/permissions/permissions";
import { createScientistTaxonomy, updateScientistTaxonomy } from "@/server/actions/scientist.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { ScientistService } from "@/server/services/scientist.service";
import { scientificOrganizationTypes, type ScientistOrganization, type ScientistTaxonomyItem, type ScientificOrganizationType } from "@/types/domain/scientist";

const organizationTypeLabels: Record<ScientificOrganizationType, string> = {
  university: "Университет",
  research_center: "Исследовательский центр",
  hospital: "Медицинская организация",
  company: "Компания",
  government: "Государственная организация",
  ngo: "Некоммерческая организация",
  school: "Школа",
  other: "Другое",
};

function orderedFields(fields: ScientistTaxonomyItem[]) {
  const result: Array<{ item: ScientistTaxonomyItem; depth: number }> = [];
  const visited = new Set<string>();
  const append = (parentId: string | null, depth: number) => {
    fields.filter(item => item.parentId === parentId).sort((a, b) => a.nameRu.localeCompare(b.nameRu, "ru"))
      .forEach(item => { if (!visited.has(item.id)) { visited.add(item.id); result.push({ item, depth }); append(item.id, depth + 1); } });
  };
  append(null, 0);
  fields.filter(item => !visited.has(item.id)).forEach(item => result.push({ item, depth: 0 }));
  return result;
}

const statusLabel = (active: boolean) => active ? "Активна" : "Отключена";

export default async function ScientistTaxonomyPage({ searchParams }: { searchParams: Promise<{ created?: string; saved?: string; error?: string }> }) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canEditScientist(result.access)) notFound();
  const [taxonomy, state] = await Promise.all([new ScientistService().listTaxonomy(result.access, true), searchParams]);
  const fields = orderedFields(taxonomy.fields);
  const errors: Record<string, string> = {
    validation: "Проверьте обязательные поля и формат значений.",
    stale_version: "Запись уже изменена. Обновите страницу и повторите действие.",
    invalid_reference: "Родительское направление недоступно или создаёт цикл.",
    invalid_transition: "Сначала отключите дочерние направления.",
    slug_conflict: "Этот slug уже занят.",
    forbidden: "Недостаточно прав для управления справочниками.",
    action_failed: "Не удалось сохранить запись справочника.",
  };

  return <div className="content-page">
    <Link className="back-link" href="/admin/science/scientists"><ArrowLeft aria-hidden="true" />Назад к учёным</Link>
    <div className="page-heading"><div><p className="page-kicker">Справочники сообщества</p><h1>Организации и направления</h1><p>Переводы хранятся отдельно; направления образуют иерархию, а отключённые значения остаются в существующих записях.</p></div></div>
    {state.created === "1" ? <div className="notice success-notice">Запись справочника создана.</div> : null}
    {state.saved === "1" ? <div className="notice success-notice">Изменения справочника сохранены.</div> : null}
    {state.error ? <div className="notice error-notice" role="alert">{errors[state.error] ?? errors.action_failed}</div> : null}
    <div className="taxonomy-grid directory-grid">
      <section className="taxonomy-panel directory-panel">
        <div className="panel-title"><div><h2><FlaskConical aria-hidden="true" />Научные направления</h2><p>{taxonomy.fields.length} записей · поддерживается вложенность</p></div></div>
        <div className="taxonomy-list directory-list">{fields.map(({ item, depth }) => <details key={item.id} className={item.isActive ? "" : "is-inactive"}>
          <summary style={{ paddingInlineStart: `${depth * 1.25 + 1}rem` }}><span><strong>{item.nameRu}</strong><small>{item.nameKk} · {statusLabel(item.isActive)}</small></span><code>{item.slug}</code></summary>
          <FieldForm item={item} fields={taxonomy.fields} />
        </details>)}</div>
        <div className="taxonomy-create-panel"><h3>Новое направление</h3><FieldForm fields={taxonomy.fields} /></div>
      </section>
      <section className="taxonomy-panel directory-panel">
        <div className="panel-title"><div><h2><Building2 aria-hidden="true" />Организации</h2><p>{taxonomy.organizations.length} записей · типизированный каталог</p></div></div>
        <div className="taxonomy-list directory-list">{taxonomy.organizations.map(item => <details key={item.id} className={item.isActive ? "" : "is-inactive"}>
          <summary><span><strong>{item.nameRu}</strong><small>{organizationTypeLabels[item.organizationType]}{item.cityRu ? ` · ${item.cityRu}` : ""} · {statusLabel(item.isActive)}</small></span><code>{item.slug}</code></summary>
          <OrganizationForm item={item} />
        </details>)}</div>
        <div className="taxonomy-create-panel"><h3>Новая организация</h3><OrganizationForm /></div>
      </section>
    </div>
  </div>;
}

function FieldForm({ item, fields }: { item?: ScientistTaxonomyItem; fields: ScientistTaxonomyItem[] }) {
  const action = item ? updateScientistTaxonomy.bind(null, item.id) : createScientistTaxonomy;
  return <form action={action} className="taxonomy-form directory-form">
    <input type="hidden" name="kind" value="field" />
    {item ? <input type="hidden" name="expectedUpdatedAt" value={item.updatedAt} /> : null}
    <label>Название RU<input name="nameRu" defaultValue={item?.nameRu ?? ""} minLength={2} maxLength={140} required /></label>
    <label>Атауы KK<input name="nameKk" defaultValue={item?.nameKk ?? ""} minLength={2} maxLength={140} required /></label>
    <label>Name EN (optional)<input name="nameEn" defaultValue={item?.nameEn ?? ""} maxLength={140} /></label>
    <label>Slug<input name="slug" defaultValue={item?.slug ?? ""} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={160} required /></label>
    <label>Родительское направление<select name="parentId" defaultValue={item?.parentId ?? ""}><option value="">Верхний уровень</option>{fields.filter(parent => parent.id !== item?.id && parent.isActive).map(parent => <option key={parent.id} value={parent.id}>{parent.nameRu}</option>)}</select></label>
    <label className="confirm-check directory-active"><input type="checkbox" name="isActive" value="yes" defaultChecked={item?.isActive ?? true} />Доступно для выбора и публичных фильтров</label>
    <button className={item ? "secondary-button" : "primary-button"} type="submit">{item ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}{item ? "Сохранить направление" : "Добавить направление"}</button>
  </form>;
}

function OrganizationForm({ item }: { item?: ScientistOrganization }) {
  const action = item ? updateScientistTaxonomy.bind(null, item.id) : createScientistTaxonomy;
  return <form action={action} className="taxonomy-form directory-form">
    <input type="hidden" name="kind" value="organization" />
    {item ? <input type="hidden" name="expectedUpdatedAt" value={item.updatedAt} /> : null}
    <label>Название RU<input name="nameRu" defaultValue={item?.nameRu ?? ""} minLength={2} maxLength={200} required /></label>
    <label>Атауы KK<input name="nameKk" defaultValue={item?.nameKk ?? ""} minLength={2} maxLength={200} required /></label>
    <label>Name EN (optional)<input name="nameEn" defaultValue={item?.nameEn ?? ""} maxLength={200} /></label>
    <label>Slug<input name="slug" defaultValue={item?.slug ?? ""} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={160} required /></label>
    <label>Тип<select name="organizationType" defaultValue={item?.organizationType ?? "other"}>{scientificOrganizationTypes.map(type => <option key={type} value={type}>{organizationTypeLabels[type]}</option>)}</select></label>
    <label>Город RU<input name="cityRu" defaultValue={item?.cityRu ?? ""} maxLength={120} /></label>
    <label>Қала KK<input name="cityKk" defaultValue={item?.cityKk ?? ""} maxLength={120} /></label>
    <label>City EN (optional)<input name="cityEn" defaultValue={item?.cityEn ?? ""} maxLength={120} /></label>
    <label>Сайт<input type="url" name="websiteUrl" defaultValue={item?.websiteUrl ?? ""} maxLength={500} placeholder="https://…" /></label>
    <label className="confirm-check directory-active"><input type="checkbox" name="isActive" value="yes" defaultChecked={item?.isActive ?? true} />Доступна для выбора и публичных фильтров</label>
    <button className={item ? "secondary-button" : "primary-button"} type="submit">{item ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}{item ? "Сохранить организацию" : "Добавить организацию"}</button>
  </form>;
}
