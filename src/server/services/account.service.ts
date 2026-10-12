import "server-only";

import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { canAccessAdmin } from "@/lib/permissions/permissions";
import { absoluteUrl } from "@/lib/seo/site";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseAccountForm, confirmationSchema, type AccountFormState, type AccountMode } from "@/lib/validation/account";
import { AccessRepository } from "@/server/repositories/access.repository";

export type AccountAccess =
  | { state: "setup" | "unauthenticated" | "unconfirmed" }
  | { state: "allowed"; email: string; displayName: string; admin: boolean };

function authFailure(error: { status?: number; code?: string } | null): AccountFormState {
  return { message: error?.status === 429 || error?.code === "over_request_rate_limit" || error?.code === "over_email_send_rate_limit" ? "rate" : "failed" };
}

export class AccountService {
  async getAccess(): Promise<AccountAccess> {
    if (!isSupabaseConfigured()) return { state: "setup" };
    const client = await createServerSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || user.is_anonymous) return { state: "unauthenticated" };
    if (!user.email || !user.email_confirmed_at) return { state: "unconfirmed" };
    const access = await new AccessRepository(client).getForUser(user.id);
    // Auth metadata is user-controlled, never an authority for permissions.
    const name = user.user_metadata?.display_name;
    return { state: "allowed", email: user.email, displayName: typeof name === "string" ? name.slice(0, 120) : "", admin: canAccessAdmin(access) };
  }

  async submit(locale: Locale, mode: AccountMode, form: FormData): Promise<AccountFormState & { navigate?: boolean }> {
    if (!isLocale(locale)) return { message: "invalid" };
    const input = parseAccountForm(mode, form);
    if (!input) return { message: "invalid" };
    if (!isSupabaseConfigured()) return { message: "setup" };
    const client = await createServerSupabaseClient();
    if (input.mode === "login") {
      const { data, error } = await client.auth.signInWithPassword({ email: input.email, password: input.password });
      if (error) return error.status === 429 ? { message: "rate" } : { message: "credentials" };
      if (!data.user?.email_confirmed_at || data.user.is_anonymous) {
        await client.auth.signOut({ scope: "local" });
        return { message: "credentials" };
      }
      return { navigate: true };
    }
    if (input.mode === "register") {
      const { error } = await client.auth.signUp({
        email: input.email, password: input.password,
        options: { data: { display_name: input.displayName }, emailRedirectTo: absoluteUrl(`/${locale}/account/confirm`) },
      });
      if (error && error.code !== "user_already_exists" && error.code !== "email_exists") return authFailure(error);
      // Same response for new and existing addresses; no account enumeration.
      return { message: "sent" };
    }
    if (input.mode === "recover") {
      const { error } = await client.auth.resetPasswordForEmail(input.email, { redirectTo: absoluteUrl(`/${locale}/account/confirm`) });
      return error ? authFailure(error) : { message: "sent" };
    }
    if (input.mode === "update-password") {
      // Repeat verification here: the action can be invoked without rendering a page.
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user?.email_confirmed_at || user.is_anonymous) return { message: "session" };
      const result = await client.auth.updateUser({ password: input.password });
      return result.error ? authFailure(result.error) : { message: "saved" };
    }
    return { message: "invalid" };
  }

  async confirm(input: unknown): Promise<"account" | "update-password" | null> {
    const parsed = confirmationSchema.safeParse(input);
    if (!parsed.success || !isSupabaseConfigured()) return null;
    const client = await createServerSupabaseClient();
    const { data, error } = await client.auth.verifyOtp(parsed.data);
    if (error || !data.user?.email_confirmed_at || data.user.is_anonymous) return null;
    return parsed.data.type === "recovery" ? "update-password" : "account";
  }

  async logout(): Promise<AccountFormState> {
    if (!isSupabaseConfigured()) return {};
    const client = await createServerSupabaseClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    return error ? authFailure(error) : {};
  }
}

export const getAccountAccess = cache(() => new AccountService().getAccess());
