import { describe, expect, it } from "vitest";
import { generateSlug } from "./slug";

describe("transliterate and generateSlug", () => {
  it("transliterates Russian titles correctly", () => {
    expect(generateSlug("Научные открытия в регионе")).toBe("nauchnye-otkrytiya-v-regione");
    expect(generateSlug("Объект № 1: новые технологии")).toBe("obekt-1-novye-tehnologii");
    expect(generateSlug("Щука, цапля и ёж")).toBe("schuka-tsaplya-i-ezh");
  });

  it("transliterates specific Kazakh letters correctly", () => {
    expect(generateSlug("Ғылыми зерттеу нәтижелері: 2026 жыл")).toBe("gylymi-zertteu-natizheleri-2026-zhyl");
    expect(generateSlug("Қазақстанның экологиясы мен өсімдіктер әлемі")).toBe("qazaqstannyn-ekologiyasy-men-osimdikter-alemi");
    expect(generateSlug("Ұлттық ғылыми орталық және үйлесім")).toBe("ulttyq-gylymi-ortalyq-zhane-uylesim");
  });

  it("handles English, numbers, and symbols gracefully", () => {
    expect(generateSlug("International Science & Research 2026!")).toBe("international-science-research-2026");
    expect(generateSlug("   Multiple   ---   Spaces   and   Symbols $$$   ")).toBe("multiple-spaces-and-symbols");
  });

  it("handles empty or symbol-only strings", () => {
    expect(generateSlug("")).toBe("");
    expect(generateSlug("   ")).toBe("");
    expect(generateSlug("@#$%^&*()")).toBe("");
  });

  it("respects max length limit", () => {
    const longTitle = "очень длинный заголовок статьи ".repeat(10);
    const slug = generateSlug(longTitle, 50);
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug).not.toMatch(/-$/);
  });
});
