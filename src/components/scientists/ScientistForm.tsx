import { collaborationKeys, collaborationLabels, scientistLinkLabels, scientistLinkTypes } from "@/lib/scientists/profile";
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
      {profile ? <input type="hidden" name="expectedContentVersion" value={profile.contentVersion} /> : null}
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
          {scientistLinkTypes.map(type => <label key={type}>{scientistLinkLabels[type]}<input type="url" name={"link_" + type} defaultValue={profile?.links.find(link => link.type === type)?.url ?? ""} maxLength={500} placeholder={type === "orcid" ? "https://orcid.org/0000-0000-0000-0000" : "https://…"} /></label>)}
        </div>
        <fieldset className="tag-fieldset">
          <legend>Публичность</legend>
          <label className="confirm-check"><input type="checkbox" name="isPublic" value="yes" defaultChecked={profile?.isPublic ?? true} />Показывать в публичном каталоге после верификации</label>
          <p className="field-hint">Закрытый профиль и его научные ссылки скрыты с публичных страниц, из поиска и SEO. Связанные программы и научные публикации также скрываются.</p>
        </fieldset>
        <fieldset className="tag-fieldset">
          <legend>Открыт к взаимодействию</legend>
          <div className="tag-options">{collaborationKeys.map((key, index) => <label key={key}><input type="checkbox" name={"collaboration_" + key} value="yes" defaultChecked={profile?.collaboration[key] ?? false} /><span>{collaborationLabels.ru[index]}</span></label>)}</div>
        </fieldset>
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
