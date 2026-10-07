import { Save } from "lucide-react";
import Link from "next/link";
import type { MediaAsset } from "@/types/domain/media";
import type { ScientistProfile, ScientistTaxonomy } from "@/types/domain/scientist";

type ScientistFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  profile?: ScientistProfile;
  taxonomy: ScientistTaxonomy;
  media: MediaAsset[];
  submitLabel?: string;
};

export function ScientistForm({ action, profile, taxonomy, media, submitLabel = "Сохранить профиль" }: ScientistFormProps) {
  const ru = profile?.translations.find((item) => item.locale === "ru");
  const kk = profile?.translations.find((item) => item.locale === "kk");
  const en = profile?.translations.find((item) => item.locale === "en");
  const selectedFields = new Set(profile?.fields.map((item) => item.id) ?? []);

  return (
    <form action={action} className="article-form scientist-form">
      <section className="article-editor-panel">
        <div className="panel-title">
          <div>
            <h2>Публичные данные</h2>
            <p>Организация, фотография, научные идентификаторы и контакты.</p>
          </div>
        </div>
        <div className="form-three-columns">
          <label>
            Организация
            <select name="organizationId" defaultValue={profile?.organizationId ?? ""}>
              <option value="">Не указана</option>
              {taxonomy.organizations.map((item) => <option value={item.id} key={item.id}>{item.nameRu}</option>)}
            </select>
          </label>
          <label>
            Аватар из медиатеки
            <select name="avatarMediaId" defaultValue={profile?.avatarMediaId ?? ""}>
              <option value="">Без фотографии</option>
              {media.map((asset) => <option value={asset.id} key={asset.id}>{asset.fileName}</option>)}
            </select>
          </label>
          <label>
            Публичный e-mail
            <input type="email" name="publicEmail" defaultValue={profile?.publicEmail ?? ""} maxLength={254} placeholder="name@example.kz" />
          </label>
          <label>
            ORCID
            <input name="orcid" defaultValue={profile?.orcid ?? ""} pattern="\d{4}-\d{4}-\d{4}-\d{3}[\dX]" placeholder="0000-0000-0000-0000" />
          </label>
          <label>
            Google Scholar / профиль
            <input type="url" name="scholarUrl" defaultValue={profile?.scholarUrl ?? ""} maxLength={500} placeholder="https://…" />
          </label>
        </div>
        <fieldset className="tag-fieldset">
          <legend>Научные направления</legend>
          {taxonomy.fields.length ? (
            <div className="tag-options">
              {taxonomy.fields.map((field) => (
                <label key={field.id}>
                  <input type="checkbox" name="fieldIds" value={field.id} defaultChecked={selectedFields.has(field.id)} />
                  <span>{field.nameRu}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="field-hint">Добавьте направления в разделе <Link href="/admin/science/scientists/taxonomy">«Справочники»</Link>.</p>
          )}
        </fieldset>
      </section>

      <div className="translation-grid">
        <ScientistTranslationFields locale="Ru" title="Русская версия" value={ru} />
        <ScientistTranslationFields locale="Kk" title="Қазақша нұсқа" value={kk} />
        <ScientistTranslationFields locale="En" title="English version (optional)" value={en} optional />
      </div>
      <div className="article-form-actions">
        <button className="primary-button" type="submit"><Save aria-hidden="true" />{submitLabel}</button>
      </div>
    </form>
  );
}

function ScientistTranslationFields({ locale, title, value, optional = false }: {
  locale: "Ru" | "Kk" | "En";
  title: string;
  value?: ScientistProfile["translations"][number];
  optional?: boolean;
}) {
  return (
    <section className="article-editor-panel translation-panel">
      <div className="panel-title">
        <div><h2>{title}</h2><p>Имя, должность и биография для публичного каталога.</p></div>
        <span className="locale-badge">{locale.toUpperCase()}</span>
      </div>
      <div className="translation-fields">
        <label>Полное имя<input name={`fullName${locale}`} defaultValue={value?.fullName ?? ""} minLength={3} maxLength={180} required={!optional} /></label>
        <label>URL slug<input name={`slug${locale}`} defaultValue={value?.slug ?? ""} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="aliya-akhmetova" required={!optional} /></label>
        <label>Должность<input name={`position${locale}`} defaultValue={value?.position ?? ""} minLength={2} maxLength={180} required={!optional} /></label>
        <label>Учёная степень<input name={`academicDegree${locale}`} defaultValue={value?.academicDegree ?? ""} maxLength={180} /></label>
        <label>Краткое описание<textarea name={`shortBio${locale}`} defaultValue={value?.shortBio ?? ""} minLength={20} maxLength={600} rows={4} required={!optional} /></label>
        <label>Биография<textarea className="article-body-field" name={`biography${locale}`} defaultValue={value?.biography ?? ""} minLength={40} maxLength={20000} rows={14} required={!optional} /></label>
      </div>
    </section>
  );
}
