/**
 * Transliteration map for Russian and Kazakh Cyrillic alphabets
 */
const cyrillicToLatinMap: Record<string, string> = {
  // Russian Cyrillic
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",

  // Kazakh specific Cyrillic
  ә: "a",
  ғ: "g",
  қ: "q",
  ң: "n",
  ө: "o",
  ұ: "u",
  ү: "u",
  һ: "h",
  і: "i",
};

/**
 * Transliterates Cyrillic text to Latin
 */
export function transliterate(text: string): string {
  const lower = text.toLowerCase();
  let result = "";
  for (let i = 0; i < lower.length; i++) {
    const char = lower[i];
    result += cyrillicToLatinMap[char] ?? char;
  }
  return result;
}

/**
 * Converts a title into a valid clean URL slug:
 * - Transliterates Russian and Kazakh Cyrillic into Latin
 * - Converts to lower case
 * - Replaces non-alphanumeric characters with hyphens
 * - Removes duplicate, leading, and trailing hyphens
 * - Truncates to max length (defaults to 160 characters)
 */
export function generateSlug(text: string, maxLength = 160): string {
  if (!text || !text.trim()) return "";

  const transliterated = transliterate(text);

  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");
}
