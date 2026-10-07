import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Pagination } from "./Pagination";
import { pageHref, readPage, readSearch } from "@/lib/search";

describe("catalog pagination", () => {
  it("preserves repeated filters, resets the first-page URL and discards legacy lang", () => {
    const query = { q: "water & lakes", tag: ["one", "two"], lang: "ru", page: "2" };
    expect(pageHref("/kk/journal", query, 3)).toBe("/kk/journal?q=water+%26+lakes&tag=one&tag=two&page=3");
    expect(pageHref("/kk/journal", query, 1)).toBe("/kk/journal?q=water+%26+lakes&tag=one&tag=two");
  });
  it("shows accessible previous, next and current-page states without listing every page", () => {
    const html = renderToStaticMarkup(<Pagination total={1500} page={40} pageSize={12} path="/en/search" query={{ q: "water" }} locale="en" />);
    expect(html).toContain('aria-current="page">40');
    expect(html).toContain('rel="prev"'); expect(html).toContain('rel="next"');
    expect(html).toContain('page=125'); expect(html).not.toContain('page=10"');
  });
  it("offers recovery from a page outside the filtered result set", () => {
    const html = renderToStaticMarkup(<Pagination total={25} page={100} pageSize={12} path="/ru/scientists" query={{ field: "water" }} locale="ru" />);
    expect(html).toContain('/ru/scientists?field=water&amp;page=3');
    expect(html).not.toContain('rel="next"');
    expect(renderToStaticMarkup(<Pagination total={0} page={1} pageSize={12} path="/ru/search" query={{}} locale="ru" />)).toBe("");
  });
  it("bounds URL input and rejects repeated or malformed page parameters", () => {
    for (const input of [undefined, ["2", "3"], "-1", "0", "1.5", "1e3", "1000001", "0002"]) expect(readPage(input)).toBe(1);
    expect(readPage("1000000")).toBe(1000000);
    expect(readSearch(["one", "two"])).toBe("");
    expect(readSearch(" water ")).toBe("water"); expect(readSearch("x".repeat(121))).toHaveLength(120);
  });
});
