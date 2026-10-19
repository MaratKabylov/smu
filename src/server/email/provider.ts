import "server-only";
import { z } from "zod";
import type { RenderedEmail } from "./templates";

export type EmailMessage = RenderedEmail & { to: string; idempotencyKey: string };
export interface EmailProvider { send(message: EmailMessage): Promise<string>; }

export class EmailProviderError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) { super(code); }
}

const configSchema = z.object({ RESEND_API_KEY: z.string().min(1), EMAIL_FROM: z.string().min(3).max(320) });
const responseSchema = z.object({ id: z.string().min(1).max(240) });

export class ResendEmailProvider implements EmailProvider {
  private readonly config = configSchema.parse({ RESEND_API_KEY: process.env.RESEND_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM });
  async send(message: EmailMessage) {
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000),
        headers: { authorization: `Bearer ${this.config.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": message.idempotencyKey },
        body: JSON.stringify({ from: this.config.EMAIL_FROM, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      });
    } catch { throw new EmailProviderError("provider_unavailable", true); }
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      throw new EmailProviderError(retryable ? "provider_retryable" : "provider_rejected", retryable);
    }
    try { return responseSchema.parse(await response.json()).id; }
    catch { throw new EmailProviderError("provider_invalid_response", true); }
  }
}

export function createEmailProvider(): EmailProvider { return new ResendEmailProvider(); }
