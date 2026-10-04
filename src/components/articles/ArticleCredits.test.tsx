import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleCredits } from "./ArticleCredits";
import { articleTypeLabel } from "@/lib/articles/presentation";
import type { ArticleAuthorCredit } from "@/types/domain/article";
const author: ArticleAuthorCredit = { id: "one", nameRu: "Автор <script>", nameKk: "Қазақша автор", bioRu: "Биография", bioKk: "Өмірбаян", organization: "University", position: "Researcher", websiteUrl: "https://example.kz", isActive: true, role: "translator" };
describe("public editorial credits", () => {
  it("renders localized roles and bios safely and respects credit order", () => {
    const ru = renderToStaticMarkup(<ArticleCredits authors={[author, { ...author, id: "two", nameRu: "Второй автор", role: "coauthor" }]} locale="ru" detailed />);
    expect(ru).toContain("Автор &lt;script&gt;"); expect(ru).not.toContain("Автор <script>");
    expect(ru).toContain("Переводчик"); expect(ru).toContain("Биография"); expect(ru.indexOf("Автор &lt;script&gt;")).toBeLessThan(ru.indexOf("Второй автор"));
    const kk = renderToStaticMarkup(<ArticleCredits authors={[author]} locale="kk" detailed />);
    expect(kk).toContain("Қазақша автор"); expect(kk).toContain("Аудармашы"); expect(kk).toContain("Өмірбаян");
  });
  it("omits unsafe links and empty credits", () => {
    expect(renderToStaticMarkup(<ArticleCredits authors={[{ ...author, websiteUrl: "javascript:alert(1)" }]} locale="ru" detailed />)).not.toContain("javascript:");
    expect(renderToStaticMarkup(<ArticleCredits authors={[]} locale="ru" />)).toBe("");
  });
  it("uses managed RU/KK labels and safely falls back for legacy codes", () => {
    const type = { id: "type", slug: "report", nameRu: "Отчёт", nameKk: "Есеп", isActive: true };
    expect(articleTypeLabel("report", type, "kk")).toBe("Есеп");
    expect(articleTypeLabel("report", type, "ru")).toBe("Отчёт");
    expect(articleTypeLabel("news", null, "kk")).toBe("Жаңалық");
    expect(articleTypeLabel("custom", null, "ru")).toBe("custom");
  });
});
