import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export class PublicFormProtectionError extends Error {
  constructor(public code: "invalid_input" | "rate_limited" | "protection_unavailable") { super(code); }
}

function networkIdentity(incoming: Pick<Headers, "get">): string {
  // These headers are trusted only when an ingress is explicitly configured
  // to overwrite them. Never fall back to client-controlled forwarding headers.
  const header = process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : process.env.PUBLIC_FORM_IP_HEADER;
  if (header && !["x-real-ip", "x-forwarded-for", "x-vercel-forwarded-for"].includes(header)) {
    throw new PublicFormProtectionError("protection_unavailable");
  }
  const address = header ? incoming.get(header)?.trim() : undefined;
  if (!address || address.includes("%") || !isIP(address)) return "unknown-network";
  if (isIP(address) === 4) return address;
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  // IPv4 mapped IPv6 must share the IPv4 bucket. Native IPv6 shares a /64
  // bucket so rotating interface addresses does not reset the rate limit.
  const parts = canonical.split("::");
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length > 1 && parts[1] ? parts[1].split(":") : [];
  const groups = parts.length > 1 ? [...left, ...Array(8-left.length-right.length).fill("0"), ...right] : left;
  const numbers = groups.map(group => parseInt(group, 16));
  if (numbers.slice(0, 5).every(n => n === 0) && numbers[5] === 65535) {
    return [numbers[6] >> 8, numbers[6] & 255, numbers[7] >> 8, numbers[7] & 255].join(".");
  }
  return numbers.slice(0, 4).map(n => n.toString(16)).join(":") + "::/64";
}

export async function protectPublicForm(form: FormData, email: string) {
  // Reject duplicate values as well as forged checkbox values. Missing traps
  // remain compatible with older rendered forms, but filled traps never pass.
  if (form.getAll("consent").length !== 1 || form.get("consent") !== "yes"
    || form.getAll("website").length > 1 || (form.has("website") && form.get("website") !== "")) {
    throw new PublicFormProtectionError("invalid_input");
  }
  const secret = process.env.PUBLIC_FORM_SECRET;
  if (!secret || secret.length < 32) throw new PublicFormProtectionError("protection_unavailable");
  const network = networkIdentity(await headers());
  const digest = (kind: string, value: string) => createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
  const { data, error } = await createServiceRoleSupabaseClient().rpc("consume_public_form_limit", {
    p_network_key: digest("network", network), p_email_key: digest("email", email.trim().toLowerCase()),
  });
  if (error || typeof data !== "boolean") throw new PublicFormProtectionError("protection_unavailable");
  if (!data) throw new PublicFormProtectionError("rate_limited");
}
