"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function login(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/admin/login?error=setup");
  }

  const credentials = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!credentials.success) {
    redirect("/admin/login?error=invalid");
  }

  const client = await createServerSupabaseClient();
  const { error } = await client.auth.signInWithPassword(credentials.data);

  if (error) redirect("/admin/login?error=credentials");

  redirect("/admin");
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const client = await createServerSupabaseClient();
    await client.auth.signOut();
  }

  redirect("/admin/login");
}
