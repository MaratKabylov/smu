import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicContentPage } from "./PublicContentPage";
import type { PublicSiteContent } from "@/lib/validation/site-content";

const content: PublicSiteContent = { page: { key: "about", template: "standard", updated_at: "now", title: "About <script>", summary: "Science", body: '<script>alert(1)</script>\n\nSecond paragraph', cta_label: "Apply", cta_href: "/ru/support", locales: ["ru", "kk"] }, sections: [], settings: { site_name: "SMU", contact_email: "science@example.org", social_links: [{ label: "Research", href: "https://example.org" }] } };
it.each(["standard", "landing", "program", "support"] as const)("renders the %s fixed template with escaped text and public settings", template => {
  const html = renderToStaticMarkup(<PublicContentPage locale="ru" content={{ ...content, page: { ...content.page!, template } }} />);
  expect(html).toContain(`information-${template}`); expect(html).toContain("About &lt;script&gt;"); expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;</p><p>Second paragraph");
  expect(html).toContain('href="/ru/support"'); expect(html).toContain('href="mailto:science@example.org"');
  expect(html).toContain('href="/kk/pages/about"'); expect(html).not.toContain('/en/pages/about');
});
it("renders no content for a missing public translation", () => {
  expect(renderToStaticMarkup(<PublicContentPage locale="en" content={{ ...content, page: null }} />)).toBe("");
});
