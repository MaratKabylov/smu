import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { renderEmail } from "./templates";
import { EmailProviderError, ResendEmailProvider } from "./provider";

const job = { id: crypto.randomUUID(), eventKey: "support:event:user", recipientEmail: "person@example.org", locale: "kk" as const, templateKey: "application_status" as const, payload: { title: "Өтінім <жаңа>", message: "Күйі өзгерді & тексеріңіз.", url: "/kk/account/support?kind=it_request" }, attempt: 1 };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("email templates and provider", () => {
  it("renders localized, escaped HTML and a same-origin text link", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://smu.example");
    const rendered = renderEmail(job);
    expect(rendered.subject).toBe("Өтінім <жаңа>");
    expect(rendered.html).toContain("Өтінім &lt;жаңа&gt;"); expect(rendered.html).toContain("Күйі өзгерді &amp; тексеріңіз.");
    expect(rendered.text).toContain("Ашу: https://smu.example/kk/account/support?kind=it_request");
  });
  it("sends a stable idempotency key and does not leak provider errors", async () => {
    vi.stubEnv("RESEND_API_KEY", "secret"); vi.stubEnv("EMAIL_FROM", "SMU <notify@example.org>");
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-id" }), { status: 200 })); vi.stubGlobal("fetch", fetch);
    await expect(new ResendEmailProvider().send({ to: job.recipientEmail, idempotencyKey: job.eventKey, subject: "Subject", html: "<p>Body</p>", text: "Body" })).resolves.toBe("email-id");
    expect(fetch.mock.calls[0][1].headers["idempotency-key"]).toBe(job.eventKey);
  });
  it("classifies temporary and permanent provider failures", async () => {
    vi.stubEnv("RESEND_API_KEY", "secret"); vi.stubEnv("EMAIL_FROM", "SMU <notify@example.org>");
    for (const [status, retryable] of [[429, true], [503, true], [422, false]] as const) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private provider detail", { status })));
      const result = new ResendEmailProvider().send({ to: job.recipientEmail, idempotencyKey: job.eventKey, subject: "Subject", html: "Body", text: "Body" });
      await expect(result).rejects.toMatchObject({ retryable }); await expect(result).rejects.toBeInstanceOf(EmailProviderError);
    }
  });
});
