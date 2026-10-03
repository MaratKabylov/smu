import { SubmitButton } from "@/components/science/SubmitButton";
import { mentorshipFormatLabels } from "@/lib/mentorship";
import { mentorshipFormats, type MentorshipOffer } from "@/types/domain/mentorship";
import type { ScienceWorkOptions } from "@/types/domain/science-work";
export function MentorshipForm({ action, offer, options }: { action: (form: FormData) => Promise<void>; offer?: MentorshipOffer; options: ScienceWorkOptions }) {
  return <form action={action} className="article-form">
    <section className="article-editor-panel"><div className="panel-title"><div><h2>Предложение наставничества</h2><p>Выберите верифицированного учёного и укажите условия участия.</p></div></div>
      <div className="form-three-columns">
        <label>Наставник<select name="scientistId" defaultValue={offer?.scientistId ?? ""} required><option value="">Выберите учёного</option>{options.scientists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{offer && !options.scientists.some(item => item.id === offer.scientistId) ? <option value={offer.scientistId}>Профиль недоступен — выберите другой</option> : null}</select></label>
        <label>Научное направление<select name="fieldId" defaultValue={offer?.fieldId ?? ""} required><option value="">Выберите направление</option>{options.fields.map(item => <option key={item.id} value={item.id}>{item.nameRu}</option>)}{offer && !options.fields.some(item => item.id === offer.fieldId) ? <option value={offer.fieldId}>Направление недоступно — выберите другое</option> : null}</select></label>
        <label>Формат<select name="format" defaultValue={offer?.format ?? "online"}>{mentorshipFormats.map(format => <option key={format} value={format}>{mentorshipFormatLabels.ru[format]}</option>)}</select></label>
        <label>Мест одновременно<input name="capacity" type="number" min={1} max={50} defaultValue={offer?.capacity ?? 3} required /><small>Принятые заявки занимают места до завершения наставничества.</small></label>
      </div>
      <p className="field-hint">С активными заявками нельзя заменить наставника. Правки возвращают предложение в черновики.</p>
    </section>
    <div className="translation-grid">{(["ru", "kk"] as const).map(locale => {
      const value = offer?.translations.find(item => item.locale === locale);
      const suffix = locale === "ru" ? "Ru" : "Kk";
      return <section className="article-editor-panel translation-panel" key={locale}><div className="panel-title"><h2>{locale === "ru" ? "Русская версия" : "Қазақша нұсқа"}</h2><span className="locale-badge">{locale.toUpperCase()}</span></div>
        <div className="translation-fields">
          <label>Название<input name={"title" + suffix} defaultValue={value?.title ?? ""} minLength={3} maxLength={240} required /></label>
          <label>URL slug<input name={"slug" + suffix} defaultValue={value?.slug ?? ""} minLength={2} maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><small>Латинские буквы, цифры и дефисы.</small></label>
          <label>Краткое описание<textarea name={"summary" + suffix} defaultValue={value?.summary ?? ""} minLength={20} maxLength={800} rows={4} required /></label>
          <label>Цели, условия и ожидаемые результаты<textarea name={"description" + suffix} defaultValue={value?.description ?? ""} minLength={40} maxLength={20000} rows={10} required /></label>
        </div>
      </section>;
    })}</div><div className="article-form-actions"><SubmitButton label={offer ? "Сохранить изменения" : "Создать черновик"} /></div>
  </form>;
}
