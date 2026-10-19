import "server-only";
import { absoluteUrl } from "@/lib/seo/site";
import type { EmailJob } from "@/lib/validation/notifications";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const actionCopy = { ru: "Открыть", kk: "Ашу", en: "Open" } as const;
const footerCopy = {
  ru: "Это служебное письмо платформы СМУ. Не отвечайте на него.",
  kk: "Бұл СМУ платформасының қызметтік хаты. Оған жауап бермеңіз.",
  en: "This is a service email from the SMU platform. Please do not reply.",
} as const;

export type RenderedEmail = { subject: string; html: string; text: string };
export function renderEmail(job: EmailJob): RenderedEmail {
  const url = absoluteUrl(job.payload.url);
  const subject = job.payload.title;
  const text = `${job.payload.message}\n\n${actionCopy[job.locale]}: ${url}\n\n${footerCopy[job.locale]}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#17251b"><h1 style="font-size:22px">${escapeHtml(subject)}</h1><p>${escapeHtml(job.payload.message)}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;background:#244d32;color:#fff;text-decoration:none;border-radius:6px">${actionCopy[job.locale]}</a></p><p style="color:#66756b;font-size:13px">${footerCopy[job.locale]}</p></div>`;
  return { subject, html, text };
}
