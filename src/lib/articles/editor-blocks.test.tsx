import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RichTextContent } from "@/components/articles/RichTextContent";
import { editorBlocksDocument, invalidEditorBlocks, paragraph } from "./editor-blocks.fixture";
import { referenceUrl, richTextDocumentSchema, richTextToPlainText, videoEmbedUrl, type RichTextNode } from "./rich-text";

describe("extended editorial blocks", () => {
  it("validates bilingual content and derives searchable table, caption and DOI text", () => {
    expect(richTextDocumentSchema.parse(editorBlocksDocument)).toEqual(editorBlocksDocument);
    const body = richTextToPlainText(editorBlocksDocument);
    expect(body).toContain("Показатель\tЗначение\nТемпература\t24 °C");
    expect(body).toContain("Методика исследования\nДемонстрация опыта");
    expect(body).toContain("Автор. Научные результаты. DOI: 10.1234/results.v2");
    expect(body).toContain("Открытые данные https://example.kz/dataset");
  });
  it.each(invalidEditorBlocks)("rejects %s", (_name, block) => {
    expect(richTextDocumentSchema.safeParse({ type: "doc", content: [block] }).success).toBe(false);
  });
  it("renders accessible tables, callouts, confined players and semantic bibliography", () => {
    const html = renderToStaticMarkup(<RichTextContent content={editorBlocksDocument} body="" />);
    expect(html).toContain('<th scope="col"><p>Показатель</p></th>');
    expect(html).toContain('<td><p>24 °C</p></td>');
    expect(html).toContain('class="rich-text-callout rich-text-callout-warning"');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain('title="Методика исследования"');
    expect(html).toContain('href="https://doi.org/10.1234/results.v2"');
    expect(html).toContain('href="https://example.kz/dataset"');
    expect(html).not.toContain('href="https://example.kz/paper"');
    expect(html).toContain('<ol><li>');
  });
  it("escapes captions, labels and titles and discards submitted HTML attributes", () => {
    const document = structuredClone(editorBlocksDocument);
    document.content![3].attrs!.title = '<script>title</script>';
    document.content![3].attrs!.caption = '<img src=x onerror=alert(1)>';
    document.content![3].attrs!.onload = "alert(1)";
    document.content![4].attrs!.title = '<script>References</script>';
    document.content![4].content![0].attrs!.label = '<script>Author</script>';
    const html = renderToStaticMarkup(<RichTextContent content={document} body="" />);
    expect(html).toContain("&lt;script&gt;Author&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>"); expect(html).not.toContain('onload="');
  });
  it("fails closed to the escaped body for an untrusted embed", () => {
    const html = renderToStaticMarkup(<RichTextContent content={{ type: "doc", content: [invalidEditorBlocks[0][1]] }} body="<b>Fallback</b>" />);
    expect(html).not.toContain("iframe"); expect(html).toContain("&lt;b&gt;Fallback&lt;/b&gt;");
  });
  it.each([
    ["https://youtu.be/dQw4w9WgXcQ?t=30", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/123456", "https://player.vimeo.com/video/123456"],
    ["https://player.vimeo.com/video/123456", "https://player.vimeo.com/video/123456"],
  ])("normalizes %s without retaining player parameters", (input, expected) => expect(videoEmbedUrl(input)).toBe(expected));
  it.each(["javascript:alert(1)", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com@evil.com/watch?v=dQw4w9WgXcQ", "https://evil.com@youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com:8080/watch?v=dQw4w9WgXcQ", "https://youtu.be/invalid", "https://vimeo.com/0", "//vimeo.com/123", "<iframe src=https://vimeo.com/123>"])("rejects untrusted video input %s", input => expect(videoEmbedUrl(input)).toBeNull());
  it("selects DOI over URL and rejects missing or executable references", () => {
    expect(referenceUrl({ label: "1", doi: "10.1234/results.v2", url: "https://example.kz" })).toBe("https://doi.org/10.1234/results.v2");
    expect(referenceUrl({ label: "1", url: "javascript:alert(1)" })).toBeNull();
  });
  it("retains library-only image rendering inside callouts and cells", () => {
    const image: RichTextNode = { type: "image", attrs: { mediaId: "00000000-0000-4000-a000-000000000008", src: "https://untrusted.example/image" } };
    const document: RichTextNode = { type: "doc", content: [{ type: "callout", attrs: { kind: "info" }, content: [paragraph("Image"), image] }, { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [image] }] }] }] };
    const html = renderToStaticMarkup(<RichTextContent content={document} body="" images={[{ id: String(image.attrs!.mediaId), url: "https://storage.example/trusted.jpg", alt: "Image", caption: null }]} />);
    expect(html.match(/src="https:\/\/storage.example\/trusted.jpg"/g)).toHaveLength(2);
    expect(html).not.toContain("untrusted.example");
  });
});
