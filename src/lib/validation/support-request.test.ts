import { expect, it } from "vitest";
import { parseSupportForm, supportFields, supportInputSchema, supportKinds, validSupportFile } from "./support-request";
const input = { kind: "it_request", locale: "kk", title: "Research system", description: "A description of the research IT request.", contactName: "A Scientist", email: " OWNER@EXAMPLE.ORG ", organization: "", consent: true, details: { currentProcess: "Manual", desiredSolution: "Automation", dataDescription: "Research data" } };
it("normalizes contact input and strips forged ownership, status and unknown details", () => {
  const parsed = supportInputSchema.parse({ ...input, owner_id: "FORGED", status: "completed", details: { ...input.details, secret: "EXTRA" } });
  expect(parsed.email).toBe("owner@example.org"); expect(parsed).not.toHaveProperty("owner_id"); expect(parsed).not.toHaveProperty("status"); expect(parsed.details).not.toHaveProperty("secret");
});
it.each(supportKinds)("parses the localized %s form with explicit consent and kind-specific fields", kind => {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) if (typeof value === "string") form.set(key, value);
  for (const field of supportFields[kind]) form.set(field, "Some research details");
  expect(parseSupportForm("kk", kind, form)).toBeNull(); form.set("consent", "yes");
  expect(parseSupportForm("kk", kind, form)?.kind).toBe(kind);
  form.set("website", "bot"); expect(parseSupportForm("kk", kind, form)).toBeNull();
});
it("rejects missing details, unknown locale, consent coercion and oversized values", () => {
  for (const extra of [{ consent: "true" }, { consent: false }, { locale: "de" }, { title: "x" }, { details: {} }, { description: "x".repeat(20001) }]) expect(supportInputSchema.safeParse({ ...input, ...extra }).success).toBe(false);
});
it("inspects PDF signature, extension, byte count and safe filename", () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\nDocument");
  expect(validSupportFile({ name: "Исследование.pdf", type: "application/pdf" }, bytes)).toBe(true);
  for (const file of [{ name: "../file.pdf", type: "application/pdf" }, { name: "file.html", type: "application/pdf" }, { name: "file.pdf", type: "text/html" }, { name: "file\n.pdf", type: "application/pdf" }]) expect(validSupportFile(file, bytes)).toBe(false);
  expect(validSupportFile({ name: "file.pdf", type: "application/pdf" }, new TextEncoder().encode("<html>forged</html>"))).toBe(false);
  expect(validSupportFile({ name: "file.pdf", type: "application/pdf" }, new Uint8Array(1048577))).toBe(false);
});
