import { eventFormatLabels, eventKindLabels, eventLocalInput } from "@/lib/events";
import { eventFormats, eventKinds, type ScienceEvent } from "@/types/domain/event";
import type { MediaAsset } from "@/types/domain/media";
import { SubmitButton } from "@/components/science/SubmitButton";

export function EventForm({ action, event, media }: {
  action: (form: FormData) => Promise<void>; event?: ScienceEvent; media: MediaAsset[];
}) {
  return <form action={action} className="article-form">
    <section className="article-editor-panel">
      <div className="panel-title"><div><h2>Паспорт события</h2><p>Все даты и время — по Актобе (UTC+05:00).</p></div></div>
      <div className="form-three-columns">
        <label>Тип события<select name="kind" defaultValue={event?.kind ?? "conference"}>{eventKinds.map(kind => <option key={kind} value={kind}>{eventKindLabels.ru[kind]}</option>)}</select></label>
        <label>Формат<select name="format" defaultValue={event?.format ?? "offline"}>{eventFormats.map(format => <option key={format} value={format}>{eventFormatLabels.ru[format]}</option>)}</select></label>
        <label>Обложка из медиатеки<select name="coverMediaId" defaultValue={event?.coverMediaId ?? ""}><option value="">Без обложки</option>{media.map(item => <option key={item.id} value={item.id}>{item.fileName}</option>)}{event?.coverMediaId && !media.some(item => item.id === event.coverMediaId) ? <option value={event.coverMediaId}>Текущая обложка</option> : null}</select></label>
        <label>Начало<input type="datetime-local" name="startsAt" defaultValue={eventLocalInput(event?.startsAt)} required /></label>
        <label>Окончание<input type="datetime-local" name="endsAt" defaultValue={eventLocalInput(event?.endsAt)} required /></label>
        <label>Дедлайн регистрации<input type="datetime-local" name="registrationDeadline" defaultValue={eventLocalInput(event?.registrationDeadline)} /></label>
        <label>Внешняя регистрация<input type="url" name="registrationUrl" defaultValue={event?.registrationUrl ?? ""} maxLength={1000} placeholder="https://…" /><small>Кнопка доступна до дедлайна или начала события.</small></label>
        <label>Публичный сайт / трансляция<input type="url" name="externalUrl" defaultValue={event?.externalUrl ?? ""} maxLength={1000} placeholder="https://…" /><small>Обязательно для онлайн и гибридного формата. Ссылка видна всем посетителям.</small></label>
      </div>
    </section>
    <div className="translation-grid">{(["ru", "kk"] as const).map(locale => {
      const value = event?.translations.find(item => item.locale === locale);
      const suffix = locale === "ru" ? "Ru" : "Kk";
      return <section className="article-editor-panel translation-panel" key={locale}>
        <div className="panel-title"><h2>{locale === "ru" ? "Русская версия" : "Қазақша нұсқа"}</h2><span className="locale-badge">{locale.toUpperCase()}</span></div>
        <div className="translation-fields">
          <label>Название<input name={"title" + suffix} defaultValue={value?.title ?? ""} minLength={3} maxLength={240} required /></label>
          <label>URL slug<input name={"slug" + suffix} defaultValue={value?.slug ?? ""} minLength={2} maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /><small>Латинские буквы, цифры и дефисы. Уникальный адрес события для этого языка.</small></label>
          <label>Организатор<input name={"organizer" + suffix} defaultValue={value?.organizer ?? ""} minLength={2} maxLength={240} required /></label>
          <label>Место проведения<input name={"location" + suffix} defaultValue={value?.location ?? ""} maxLength={500} /><small>Город, площадка и адрес. Обязательно для очного и гибридного формата.</small></label>
          <label>Краткое описание<textarea name={"summary" + suffix} defaultValue={value?.summary ?? ""} minLength={20} maxLength={800} rows={4} required /></label>
          <label>Описание и программа<textarea className="article-body-field" name={"description" + suffix} defaultValue={value?.description ?? ""} minLength={40} maxLength={30000} rows={12} required /></label>
        </div>
      </section>;
    })}</div>
    <div className="article-form-actions"><SubmitButton label={event ? "Сохранить изменения" : "Создать черновик"} /></div>
  </form>;
}
