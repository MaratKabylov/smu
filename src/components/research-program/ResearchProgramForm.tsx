import { SubmitButton } from "@/components/science/SubmitButton";
import { researchProgramFormatLabels } from "@/lib/research-program";
import { researchProgramFormats, type ResearchProgram } from "@/types/domain/research-program";
import type { ScienceWorkOptions } from "@/types/domain/science-work";
export function ResearchProgramForm({ action, program, options }: { action: (form: FormData) => Promise<void>; program?: ResearchProgram; options: ScienceWorkOptions }) {
  return <form action={action} className="article-form">
    <section className="article-editor-panel"><div className="panel-title"><div><h2>Паспорт исследовательской программы</h2><p>Выберите верифицированного координатора и укажите условия набора.</p></div></div>
      <div className="form-three-columns">
        <label>Координатор<select name="coordinatorId" defaultValue={program?.coordinatorId ?? ""} required><option value="">Выберите учёного</option>{options.scientists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{program && !options.scientists.some(item => item.id === program.coordinatorId) ? <option value={program.coordinatorId}>Профиль недоступен — выберите другой</option> : null}</select></label>
        <label>Научное направление<select name="fieldId" defaultValue={program?.fieldId ?? ""} required><option value="">Выберите направление</option>{options.fields.map(item => <option key={item.id} value={item.id}>{item.nameRu}</option>)}{program && !options.fields.some(item => item.id === program.fieldId) ? <option value={program.fieldId}>Направление недоступно — выберите другое</option> : null}</select></label>
        <label>Формат<select name="format" defaultValue={program?.format ?? "online"}>{researchProgramFormats.map(format => <option key={format} value={format}>{researchProgramFormatLabels.ru[format]}</option>)}</select></label>
        <label>Мест в наборе<input name="capacity" type="number" min={1} max={500} defaultValue={program?.capacity ?? 20} required /><small>Принятые и завершившие участие заявки учитываются в лимите набора.</small></label>
        <label>Открытие набора<input name="applicationsOpenOn" type="date" defaultValue={program?.applicationsOpenOn ?? ""} required /></label>
        <label>Последний день подачи<input name="applicationDeadline" type="date" defaultValue={program?.applicationDeadline ?? ""} required /></label>
        <label>Начало программы<input name="startsOn" type="date" defaultValue={program?.startsOn ?? ""} required /></label>
        <label>Завершение программы<input name="endsOn" type="date" defaultValue={program?.endsOn ?? ""} required /></label>
      </div>
      <p className="field-hint">С активными заявками нельзя заменить координатора. Правки возвращают программу в черновики.</p>
      <p className="field-hint">Даты: открытие набора ≤ последний день подачи ≤ начало ≤ завершение. Последний день подачи включён, время — Актобе (UTC+5).</p>
    </section>
    <div className="translation-grid">{(["ru", "kk"] as const).map(locale => {
      const value = program?.translations.find(item => item.locale === locale);
      const suffix = locale === "ru" ? "Ru" : "Kk";
      return <section className="article-editor-panel translation-panel" key={locale}><div className="panel-title"><h2>{locale === "ru" ? "Русская версия" : "Қазақша нұсқа"}</h2><span className="locale-badge">{locale.toUpperCase()}</span></div>
        <div className="translation-fields">
          <label>Название<input name={"title" + suffix} defaultValue={value?.title ?? ""} minLength={3} maxLength={240} required /></label>
          <label>URL slug<input name={"slug" + suffix} defaultValue={value?.slug ?? ""} minLength={2} maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><small>Латинские буквы, цифры и дефисы.</small></label>
          <label>Краткое описание<textarea name={"summary" + suffix} defaultValue={value?.summary ?? ""} minLength={20} maxLength={800} rows={4} required /></label>
          <label>Описание и цели<textarea name={"description" + suffix} defaultValue={value?.description ?? ""} minLength={40} maxLength={20000} rows={6} required /></label>
          <label>План занятий и этапы<textarea name={"curriculum" + suffix} defaultValue={value?.curriculum ?? ""} minLength={20} maxLength={10000} rows={6} required /></label>
          <label>Требования к участникам<textarea name={"eligibility" + suffix} defaultValue={value?.eligibility ?? ""} minLength={20} maxLength={5000} rows={4} required /></label>
          <label>Ожидаемые результаты<textarea name={"outcomes" + suffix} defaultValue={value?.outcomes ?? ""} minLength={20} maxLength={10000} rows={4} required /></label>
        </div>
      </section>;
    })}</div><div className="article-form-actions"><SubmitButton label={program ? "Сохранить изменения" : "Создать черновик"} /></div>
  </form>;
}
