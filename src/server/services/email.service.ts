import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { NotificationRepository } from "@/server/repositories/notification.repository";
import { createEmailProvider, EmailProviderError, type EmailProvider } from "@/server/email/provider";
import { renderEmail } from "@/server/email/templates";

export class EmailService {
  constructor(private readonly provider: EmailProvider = createEmailProvider()) {}

  async process(limit = 20) {
    const repository = new NotificationRepository(createServiceRoleSupabaseClient());
    const worker = crypto.randomUUID();
    const jobs = await repository.claim(limit, worker);
    let sent = 0, retried = 0, failed = 0;
    for (const job of jobs) {
      try {
        const providerId = await this.provider.send({ ...renderEmail(job), to: job.recipientEmail, idempotencyKey: job.eventKey });
        await repository.finish(job.id, worker, true, providerId, null);
        sent++;
      } catch (error) {
        const known = error instanceof EmailProviderError ? error : new EmailProviderError("delivery_failed", true);
        const state = await repository.finish(job.id, worker, false, null, known.code, known.retryable);
        if (state === "failed") failed++; else retried++;
      }
    }
    return { claimed: jobs.length, sent, retried, failed };
  }
}
