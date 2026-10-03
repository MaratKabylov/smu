/** Maps expected RPC failures; unexpected storage/network errors remain intact. */
export function databaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("code" in error && error.code === "23505") return "slug_conflict";
  if (!("message" in error) || typeof error.message !== "string") return null;
  return ["forbidden", "not_found", "invalid_transition", "invalid_reference", "invalid_input", "slug_reserved", "stale_version"]
    .includes(error.message) ? error.message : null;
}
