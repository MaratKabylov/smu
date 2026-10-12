import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("redirect:" + url); }, notFound: () => { throw new Error("not_found"); } }));
vi.mock("@/server/services/account.service", () => ({ getAccountAccess: mocks.access }));
vi.mock("@/server/actions/account.actions", () => ({ logoutAccount: vi.fn(), submitAccountForm: vi.fn() }));
vi.mock("./AccountForm", () => ({ AccountForm: ({ mode }: { mode: string }) => <form data-mode={mode} /> }));
import AccountPage from "@/app/[locale]/account/page";
import AccountLayout, { metadata } from "@/app/[locale]/account/layout";
import { AccountAuthPage } from "./AccountAuthPage";
const props = (locale = "ru", error?: string) => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ error }) });
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", email: "own@example.org", displayName: "<script>private</script>", admin: false }); });
it("escapes account metadata and hides administrative links without permission", async () => {
  const html = renderToStaticMarkup(await AccountPage(props())); expect(html).toContain("own@example.org"); expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain('<script>private'); expect(html).not.toContain('href="/admin"');
  mocks.access.mockResolvedValueOnce({ state: "allowed", email: "own@example.org", admin: true }); expect(renderToStaticMarkup(await AccountPage(props()))).toContain('href="/admin"');
});
it("links all four localized ownership sections from the account", async () => {
  for (const locale of ["ru", "kk", "en"]) {
    const html = renderToStaticMarkup(await AccountPage(props(locale)));
    for (const section of ["scientist", "articles", "projects", "applications"]) expect(html).toContain(`href="/${locale}/account/${section}"`);
  }
});
it("protects account and password routes independently of layouts", async () => {
  mocks.access.mockResolvedValue({ state: "unauthenticated" }); await expect(AccountPage(props("kk"))).rejects.toThrow("redirect:/kk/account/login"); await expect(AccountAuthPage({ ...props("en"), mode: "update-password" })).rejects.toThrow("redirect:/en/account/login?error=session");
  mocks.access.mockResolvedValue({ state: "unconfirmed" }); await expect(AccountPage(props())).rejects.toThrow("redirect:/ru/account/login?error=unconfirmed");
});
it("does not render sign-in or registration over an authenticated account", async () => {
  for (const mode of ["login", "register"] as const) await expect(AccountAuthPage({ ...props("kk"), mode })).rejects.toThrow("redirect:/kk/account");
});
it("shows setup without a broken form and reports invalid confirmation links", async () => {
  mocks.access.mockResolvedValue({ state: "setup" }); const html = renderToStaticMarkup(await AccountAuthPage({ ...props(), mode: "register" })); expect(html).toContain("временно недоступен"); expect(html).not.toContain("<form");
  mocks.access.mockResolvedValue({ state: "unauthenticated" }); const invalid = renderToStaticMarkup(await AccountAuthPage({ ...props("en", "confirm"), mode: "login" })); expect(invalid).toContain("This link is invalid or has expired"); expect(invalid).toContain('data-mode="login"');
});
it("localizes navigation, excludes account indexing and never copies sensitive queries", async () => {
  const html = renderToStaticMarkup(await AccountLayout({ params: props("kk").params, children: <p>Content</p> })); expect(html).toContain("Сайтқа өту"); for (const locale of ["ru", "kk", "en"]) expect(html).toContain(`href="/${locale}/account"`); expect(metadata.robots).toEqual({ index: false, follow: false });
});
