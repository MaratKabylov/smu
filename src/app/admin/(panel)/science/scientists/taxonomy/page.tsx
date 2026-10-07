import { ArrowLeft, Building2, FlaskConical, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canEditScientist } from "@/lib/permissions/permissions";
import { createScientistTaxonomy } from "@/server/actions/scientist.actions";
import { getAdminAccess } from "@/server/services/access.service";
import { ScientistService } from "@/server/services/scientist.service";

export default async function ScientistTaxonomyPage({ searchParams }: { searchParams: Promise<{ created?: string; error?: string }> }) {
  const result = await getAdminAccess();
  if (result.state !== "allowed") return null;
  if (!canEditScientist(result.access)) notFound();
  const [taxonomy, state] = await Promise.all([new ScientistService().listTaxonomy(result.access, true), searchParams]);
  return <div className="content-page">
    <Link className="back-link" href="/admin/science/scientists"><ArrowLeft aria-hidden="true" />Назад к учёным</Link>
    <div className="page-heading"><div><p className="page-kicker">Справочники сообщества</p><h1>Организации и направления</h1><p>Единые двуязычные значения для профилей и фильтров публичного каталога.</p></div></div>
    {state.created === "1" ? <div className="notice success-notice">Запись справочника создана.</div> : null}
    {state.error ? <div className="notice error-notice" role="alert">Проверьте поля и уникальность slug.</div> : null}
    <div className="taxonomy-grid">
      <section className="taxonomy-panel">
        <div className="panel-title"><div><h2><FlaskConical aria-hidden="true" />Научные направления</h2><p>{taxonomy.fields.length} записей</p></div></div>
        <div className="taxonomy-list">{taxonomy.fields.map((item) => <div key={item.id}><strong>{item.nameRu}</strong><span>{item.nameKk}</span><code>{item.slug}</code></div>)}</div>
        <form action={createScientistTaxonomy} className="taxonomy-form"><input type="hidden" name="kind" value="field" /><label>Название RU<input name="nameRu" required /></label><label>Атауы KK<input name="nameKk" required /></label><label>Name EN (optional)<input name="nameEn" /></label><label>Slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><button className="primary-button" type="submit"><Plus aria-hidden="true" />Добавить направление</button></form>
      </section>
      <section className="taxonomy-panel">
        <div className="panel-title"><div><h2><Building2 aria-hidden="true" />Организации</h2><p>{taxonomy.organizations.length} записей</p></div></div>
        <div className="taxonomy-list">{taxonomy.organizations.map((item) => <div key={item.id}><strong>{item.nameRu}</strong><span>{item.nameKk}{item.cityRu ? ` · ${item.cityRu}` : ""}</span><code>{item.slug}</code></div>)}</div>
        <form action={createScientistTaxonomy} className="taxonomy-form"><input type="hidden" name="kind" value="organization" /><label>Название RU<input name="nameRu" required /></label><label>Атауы KK<input name="nameKk" required /></label><label>Name EN (optional)<input name="nameEn" /></label><label>Slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label>Город RU<input name="cityRu" /></label><label>Қала KK<input name="cityKk" /></label><label>City EN (optional)<input name="cityEn" /></label><label>Сайт<input type="url" name="websiteUrl" placeholder="https://…" /></label><button className="primary-button" type="submit"><Plus aria-hidden="true" />Добавить организацию</button></form>
      </section>
    </div>
  </div>;
}
