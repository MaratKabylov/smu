import { describe, expect, it } from "vitest";
import { publicationInputSchema } from "./publication";
const input = {
  scientistId: "00000000-0000-4000-a000-000000000001", title: "A scientific paper in its original language",
  year: "2026", journal: "Regional science", doi: "10.1234/region", url: "https://example.kz/paper",
  publicationType: "article", status: "published",
};
describe("scientific bibliographic input", () => {
  it("accepts an original title and a form year without creating editorial translations", () => {
    expect(publicationInputSchema.parse(input)).toMatchObject({ title: input.title, year: 2026 });
  });
  it("supports optional DOI and URL and microsecond optimistic timestamps", () => {
    expect(publicationInputSchema.parse({ ...input, doi: "", url: "", expectedUpdatedAt: "2026-10-04T13:00:00.123456+00:00" })).toMatchObject({ doi: null, url: null });
  });
  it("rejects unsafe links, malformed DOI and unrecognized types", () => {
    for (const patch of [{ url: "javascript:alert(1)" }, { url: "ftp://example.kz/paper" }, { doi: "not-a-doi" }, { publicationType: "editorial" }, { scientistId: "not-a-uuid" }]) {
      expect(publicationInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
    }
  });
  it("rejects invalid dates, empty years and incomplete bibliographic records", () => {
    for (const patch of [{ year: "" }, { year: "2026.5" }, { year: "2201" }, { title: "ab" }, { journal: "" }, { expectedUpdatedAt: "yesterday" }]) {
      expect(publicationInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
    }
  });
});

const coauthor = "00000000-0000-4000-a000-000000000002";
const work = "00000000-0000-4000-a000-000000000003";
describe("publication graph validation", () => {
  it("accepts ordered profile and external authors, trimming bibliography without overriding profile names", () => {
    expect(publicationInputSchema.parse({ ...input, coauthors: [{ scientistId: coauthor }, { scientistId: null, name: " External Author ", affiliation: " Institute " }], workIds: [work] })).toMatchObject({ coauthors: [{ scientistId: coauthor, name: "", affiliation: "" }, { scientistId: null, name: "External Author", affiliation: "Institute" }], workIds: [work] });
  });
  it("rejects repeated authors/works, mismatched author types, excessive lists and unknown author data", () => {
    for (const patch of [{ coauthors: [{ scientistId: input.scientistId }] }, { coauthors: [{ scientistId: coauthor }, { scientistId: coauthor }] }, { coauthors: [{ scientistId: coauthor, name: "Override" }] }, { coauthors: [{ scientistId: null, name: " " }] }, { coauthors: [{ scientistId: null, name: "Author", email: "private@example.kz" }] }, { coauthors: Array.from({ length: 31 }, () => ({ scientistId: null, name: "Author" })) }, { workIds: [work, work] }, { workIds: Array.from({ length: 21 }, () => work) }, { coauthors: "[]" }]) expect(publicationInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
});
