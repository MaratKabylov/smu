"use client";
import { useActionState } from "react";
import { submitMentorshipApplication } from "@/server/actions/mentorship.actions";
import type { ScientistLocale } from "@/types/domain/scientist";
const messages: Record<ScientistLocale, Record<string, string>> = {
  ru: { validation: "Проверьте имя, email, мотивацию (от 40 символов) и согласие на обработку заявки.", submitted: "Заявка отправлена. Координатор свяжется с вами по указанному email после рассмотрения.", not_available: "Приём заявок на это предложение закрыт.", capacity_exceeded: "Все места заняты. Выберите другое предложение или попробуйте позже.", duplicate_application: "Ваша заявка на это предложение уже находится на рассмотрении или принята.", rate_limited: "С этого email можно отправить до трёх заявок за 24 часа. Попробуйте позже.", action_failed: "Не удалось отправить заявку. Повторите попытку позже." },
  kk: { validation: "Аты-жөніңізді, email, уәжіңізді (кемінде 40 таңба) және өтінімді өңдеуге келісімді тексеріңіз.", submitted: "Өтінім жіберілді. Қарастырылғаннан кейін үйлестіруші сізбен email арқылы байланысады.", not_available: "Бұл ұсынысқа өтінім қабылдау жабық.", capacity_exceeded: "Барлық орындар толды. Басқа ұсынысты таңдаңыз немесе кейінірек көріңіз.", duplicate_application: "Бұл ұсынысқа өтініміңіз қарастырылуда немесе қабылданды.", rate_limited: "Бір email арқылы 24 сағат ішінде үш өтінімге дейін жіберуге болады. Кейінірек көріңіз.", action_failed: "Өтінімді жіберу мүмкін болмады. Кейінірек қайталап көріңіз." },
  en: { validation: "Check your name, email, motivation (at least 40 characters) and consent.", submitted: "Your application has been sent. The coordinator will contact you by email after review.", not_available: "Applications for this offer are closed.", capacity_exceeded: "All places are taken. Choose another offer or try again later.", duplicate_application: "Your application for this offer is already under review or accepted.", rate_limited: "Up to three applications may be sent from one email address in 24 hours. Try again later.", action_failed: "The application could not be sent. Try again later." },
};
export function ApplicationForm({ offerId, locale }: { offerId: string; locale: ScientistLocale }) {
  const [state, action, pending] = useActionState(submitMentorshipApplication, { code: "" });
  if (state.code === "submitted") return <div className="notice success-notice" role="status">{messages[locale].submitted}</div>;
  return <form action={action} className="mentorship-public-form">
    <h2>{locale === "ru" ? "Подать заявку" : "Өтінім беру"}</h2><p>{locale === "ru" ? "Расскажите о своих целях. Решение принимает координатор программы." : "Мақсаттарыңыз туралы айтыңыз. Шешімді бағдарлама үйлестірушісі қабылдайды."}</p>
    {state.code ? <div className="notice error-notice" role="alert">{messages[locale][state.code] ?? messages[locale].action_failed}</div> : null}
    <input type="hidden" name="offerId" value={offerId} /><input type="hidden" name="locale" value={locale} />
    <div className="mentorship-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label>{locale === "ru" ? "Имя и фамилия" : "Аты-жөніңіз"}<input name="fullName" autoComplete="name" minLength={2} maxLength={160} required /></label>
    <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    <label>{locale === "ru" ? "Цели и мотивация" : "Мақсаттарыңыз бен уәжіңіз"}<textarea name="motivation" minLength={40} maxLength={5000} rows={6} required /></label>
    <label className="mentorship-consent"><input type="checkbox" name="consent" value="yes" required /><span>{locale === "ru" ? "Согласен(на) на хранение и обработку имени, email и мотивации координаторами СМУ для рассмотрения заявки и связи со мной. Эти данные не публикуются." : "Өтінімді қарастыру және менімен байланысу үшін СМУ үйлестірушілерінің аты-жөнімді, email және уәжімді сақтауына және өңдеуіне келісемін. Бұл деректер жарияланбайды."}</span></label>
    <button type="submit" className="primary-button" disabled={pending}>{pending ? (locale === "ru" ? "Отправляем…" : "Жіберілуде…") : (locale === "ru" ? "Отправить заявку" : "Өтінімді жіберу")}</button>
  </form>;
}
