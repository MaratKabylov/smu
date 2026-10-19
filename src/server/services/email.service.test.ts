import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ claim: vi.fn(), finish: vi.fn(), client: {} }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: () => mocks.client }));
vi.mock("@/server/repositories/notification.repository", () => ({ NotificationRepository: class { claim = mocks.claim; finish = mocks.finish; } }));
import { EmailProviderError, type EmailProvider } from "@/server/email/provider";
import { EmailService } from "./email.service";

const jobs = [
  { id: "00000000-0000-4000-a000-000000000201", eventKey: "event:sent", recipientEmail: "one@example.org", locale: "ru" as const, templateKey: "application_received" as const, payload: { title: "Получено", message: "Заявка получена.", url: "/ru/account" }, attempt: 1 },
  { id: "00000000-0000-4000-a000-000000000202", eventKey: "event:retry", recipientEmail: "two@example.org", locale: "kk" as const, templateKey: "application_status" as const, payload: { title: "Күй", message: "Күй өзгерді.", url: "/kk/account" }, attempt: 2 },
  { id: "00000000-0000-4000-a000-000000000203", eventKey: "event:failed", recipientEmail: "three@example.org", locale: "en" as const, templateKey: "assignment" as const, payload: { title: "Assigned", message: "Assigned to you.", url: "/admin/support/it_request" }, attempt: 1 },
];
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://smu.example"); mocks.claim.mockResolvedValue(jobs); mocks.finish.mockResolvedValueOnce("sent").mockResolvedValueOnce("pending").mockResolvedValueOnce("failed"); });

describe("EmailService", () => {
  it("finishes successes, retries transient failures and dead-letters permanent ones", async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValueOnce("provider-id").mockRejectedValueOnce(new EmailProviderError("provider_retryable", true)).mockRejectedValueOnce(new EmailProviderError("provider_rejected", false)) };
    await expect(new EmailService(provider).process(3)).resolves.toEqual({ claimed: 3, sent: 1, retried: 1, failed: 1 });
    expect(provider.send).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: "one@example.org", idempotencyKey: "event:sent" }));
    const worker = mocks.claim.mock.calls[0][1];
    expect(mocks.finish).toHaveBeenNthCalledWith(1, jobs[0].id, worker, true, "provider-id", null);
    expect(mocks.finish).toHaveBeenNthCalledWith(2, jobs[1].id, worker, false, null, "provider_retryable", true);
    expect(mocks.finish).toHaveBeenNthCalledWith(3, jobs[2].id, worker, false, null, "provider_rejected", false);
  });
});
