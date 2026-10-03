import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RichTextContent } from "@/components/articles/RichTextContent";
import { plainTextDocument, richTextDocumentSchema, richTextToPlainText, type RichTextNode } from "./rich-text";

describe("structured article content", () => {
  it("round-trips legacy text including whitespace, empty lines and literal markup", () => {
    const text = "  Leading spaces\n\n<script>alert(1)</script>\n  ";
    expect(richTextToPlainText(plainTextDocument(text))).toBe(text);
    expect(richTextDocumentSchema.safeParse(plainTextDocument(text)).success).toBe(true);
  });
  it("renders semantic formatting and escapes text without injecting HTML", () => {
    const document: RichTextNode = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Results" }] }, { type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)>", marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://example.kz" } }] }] }] };
    const html = renderToStaticMarkup(<RichTextContent content={document} body="" />);
    expect(html).toContain("<h2>Results</h2>");
    expect(html).toContain("<strong>&lt;img");
    expect(html).toContain('href="https://example.kz"'); expect(html).not.toContain("<img");
  });
  it.each(["javascript:alert(1)", "data:text/html,script", "vbscript:msgbox(1)", "https://example.kz\nscript"])("rejects unsafe links: %s", href => {
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "link", marks: [{ type: "link", attrs: { href } }] }] }] }).success).toBe(false);
  });
  it("rejects unknown nodes, invalid nesting, excessive depth and oversized documents", () => {
    for (const value of [{ type: "doc", content: [{ type: "iframe" }] }, { type: "doc", content: [{ type: "text", text: "bad nesting" }] }, { type: "doc", content: [{ type: "heading", attrs: { level: 1 } }] }])
      expect(richTextDocumentSchema.safeParse(value).success).toBe(false);
    let deep: RichTextNode = { type: "paragraph" };
    for (let i = 0; i < 25; i++) deep = { type: "blockquote", content: [deep] };
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [deep] }).success).toBe(false);
    expect(richTextDocumentSchema.safeParse(plainTextDocument("x".repeat(1_000_001))).success).toBe(false);
  });
  it("uses a trusted media URL and ignores submitted image URLs and HTML captions", () => {
    const content = { type: "doc", content: [{ type: "image", attrs: { mediaId: "00000000-0000-4000-a000-000000000008", src: "https://untrusted.example/image", caption: "<script>caption</script>" } }] };
    const html = renderToStaticMarkup(<RichTextContent content={content} body="" images={[{ id: "00000000-0000-4000-a000-000000000008", url: "https://storage.example/safe.jpg", alt: "Image", caption: null }]} />);
    expect(html).toContain('src="https://storage.example/safe.jpg"');
    expect(html).not.toContain("untrusted.example"); expect(html).toContain("&lt;script&gt;caption");
    expect(renderToStaticMarkup(<RichTextContent content={content} body="" />)).not.toContain("<img");
  });
  it("falls back to escaped plain text for an unsupported legacy document", () => {
    const html = renderToStaticMarkup(<RichTextContent content={{ type: "script", text: "evil" }} body="<script>literal</script>" />);
    expect(html).toContain("&lt;script&gt;literal"); expect(html).not.toContain("<script>");
  });
});
