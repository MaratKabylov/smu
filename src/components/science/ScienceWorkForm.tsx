import Link from "next/link";
import type { MediaAsset } from "@/types/domain/media";
import { scienceWorkStageLabels } from "@/lib/science-work";
import { scienceWorkStages, type ScienceWork, type ScienceWorkOptions } from "@/types/domain/science-work";
import { SubmitButton } from "./SubmitButton";

type Props = {
  action: (form: FormData) => Promise<void>;
  work?: ScienceWork;
  options: ScienceWorkOptions;
  media: MediaAsset[];
};
export function ScienceWorkForm({ action, work, options, media }: Props) {
  const leader = work?.members.find(item => item.role === "lead");
  const members = new Set(work?.members.filter(item => item.role === "member").map(item => item.id) ?? []);
  const scientists = [...options.scientists];
  for (const member of work?.members ?? []) {
    if (!scientists.some(item => item.id === member.id)) scientists.push({ id: member.id, name: (member.translations.find(item => item.locale === "ru")?.fullName ?? member.id) + " (недоступен — удалите из команды)" });
  }
  return <form action={action} className="article-form">
    <section className="article-editor-panel">
      <div className="panel-title"><div><h2>Паспорт научной работы</h2><p>Направление, организация, сроки и научные ссылки.</p></div></div>
      <div className="form-three-columns">
        <label>Этап работы<select name="stage" defaultValue={work?.stage ?? "planned"}>{scienceWorkStages.map(stage => <option key={stage} value={stage}>{scienceWorkStageLabels.ru[stage]}</option>)}</select></label>
        <label>Научное направление<select name="fieldId" defaultValue={work?.fieldId ?? ""} required><option value="">Выберите направление</option>{options.fields.map(item => <option key={item.id} value={item.id}>{item.nameRu}</option>)}{work && !options.fields.some(item => item.id === work.fieldId) ? <option value={work.fieldId}>Направление недоступно — выберите другое</option> : null}</select></label>
        <label>Организация<select name="organizationId" defaultValue={work?.organizationId ?? ""}><option value="">Не указана</option>{options.organizations.map(item => <option key={item.id} value={item.id}>{item.nameRu}</option>)}{work?.organizationId && !options.organizations.some(item => item.id === work.organizationId) ? <option value={work.organizationId}>Организация недоступна — выберите другую</option> : null}</select></label>
        <label>Дата начала<input type="date" name="startDate" defaultValue={work?.startDate ?? ""} /></label>
        <label>Дата окончания<input type="date" name="endDate" defaultValue={work?.endDate ?? ""} /></label>
        <label>Обложка из медиатеки<select name="coverMediaId" defaultValue={work?.coverMediaId ?? ""}><option value="">Без обложки</option>{media.map(item => <option key={item.id} value={item.id}>{item.fileName}</option>)}{work?.coverMediaId && !media.some(item => item.id === work.coverMediaId) ? <option value={work.coverMediaId}>Текущая обложка</option> : null}</select></label>
        <label>Сайт / научная публикация<input type="url" name="externalUrl" defaultValue={work?.externalUrl ?? ""} maxLength={500} placeholder="https://…" /></label>
        <label>DOI<input name="doi" defaultValue={work?.doi ?? ""} maxLength={200} placeholder="10.1234/example" /></label>
        <label>Руководитель<select name="leadScientistId" defaultValue={leader?.id ?? ""}><option value="">Не указан</option>{scientists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <fieldset className="tag-fieldset"><legend>Участники команды</legend><p className="field-hint">Выбирайте верифицированных учёных. Руководителя не нужно отмечать повторно.</p><div className="tag-options">{scientists.map(item => <label key={item.id}><input type="checkbox" name="memberIds" value={item.id} defaultChecked={members.has(item.id)} /><span>{item.name}</span></label>)}</div></fieldset>
      {!options.fields.length ? <p className="field-hint">Добавьте направление в <Link href="/admin/science/scientists/taxonomy">справочниках научного сообщества</Link>.</p> : null}
    </section>
    <div className="translation-grid">{(["ru", "kk"] as const).map(locale => {
      const value = work?.translations.find(item => item.locale === locale);
      const suffix = locale === "ru" ? "Ru" : "Kk";
      return <section className="article-editor-panel translation-panel" key={locale}>
        <div className="panel-title"><h2>{locale === "ru" ? "Русская версия" : "Қазақша нұсқа"}</h2><span className="locale-badge">{locale.toUpperCase()}</span></div>
        <div className="translation-fields">
          <label>Название<input name={"title" + suffix} defaultValue={value?.title ?? ""} minLength={3} maxLength={240} required /></label>
          <label>URL slug<input name={"slug" + suffix} defaultValue={value?.slug ?? ""} minLength={2} maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><small>Латинские буквы, цифры и дефисы. Slug должен быть уникальным среди исследований и проектов.</small></label>
          <label>Краткое описание<textarea name={"summary" + suffix} defaultValue={value?.summary ?? ""} minLength={20} maxLength={800} rows={4} required /></label>
          <label>Описание и цели<textarea className="article-body-field" name={"description" + suffix} defaultValue={value?.description ?? ""} minLength={40} maxLength={30000} rows={12} required /></label>
          <label>Результаты<textarea name={"results" + suffix} defaultValue={value?.results ?? ""} maxLength={20000} rows={6} /></label>
        </div>
      </section>;
    })}</div>
    <div className="article-form-actions"><SubmitButton label={work ? "Сохранить изменения" : "Создать черновик"} /></div>
  </form>;
}
