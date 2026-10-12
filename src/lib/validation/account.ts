import { z } from "zod";

export const accountEmailSchema = z.object({ email: z.email().trim().max(254) });
export const accountLoginSchema = accountEmailSchema.extend({ password: z.string().min(1).max(256) });
export const accountPasswordSchema = z.object({
  password: z.string().min(8).max(256),
  confirmPassword: z.string().max(256),
}).refine(value => value.password === value.confirmPassword, { path: ["confirmPassword"] });
export const accountRegistrationSchema = accountEmailSchema.extend({
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(256),
  confirmPassword: z.string().max(256),
}).refine(value => value.password === value.confirmPassword, { path: ["confirmPassword"] });

export const accountModes = ["login", "register", "recover", "update-password"] as const;
export type AccountMode = (typeof accountModes)[number];
export type AccountFormState = { message?: "invalid" | "setup" | "credentials" | "failed" | "sent" | "saved" | "session" | "rate" };

export function parseAccountForm(mode: AccountMode, form: FormData) {
  const input = Object.fromEntries(["email", "password", "confirmPassword", "displayName"].map(key => [key, form.get(key)]));
  switch (mode) {
    case "login": { const result = accountLoginSchema.safeParse(input); return result.success ? { mode, ...result.data } : null; }
    case "register": { const result = accountRegistrationSchema.safeParse(input); return result.success ? { mode, ...result.data } : null; }
    case "recover": { const result = accountEmailSchema.safeParse(input); return result.success ? { mode, ...result.data } : null; }
    case "update-password": { const result = accountPasswordSchema.safeParse(input); return result.success ? { mode, ...result.data } : null; }
    default: return null;
  }
}

export const confirmationSchema = z.object({
  token_hash: z.string().regex(/^[a-f0-9]{32,128}$/i),
  type: z.enum(["email", "signup", "recovery"]),
});
