import { describe, expect, it } from "vitest";
import { publicScientistFiltersSchema, scientistInputSchema, scientistVerificationSchema, scientistMergeSchema } from "./scientist";

const validInput = {
  organizationId: "",
  avatarMediaId: "",
  fieldIds: [],
  publicEmail: "scientist@example.kz",
  orcid: "0000-0002-1825-0097",
  scholarUrl: "https://scholar.google.com/example",
  ru: {
    fullName: "Алия Сериковна Ахметова",
    slug: "aliya-akhmetova",
    position: "Научный сотрудник",
    academicDegree: "PhD",
    shortBio: "Исследователь новых материалов и региональных технологий.",
    biography: "Алия занимается исследованиями новых материалов и развивает научные проекты региона.",
  },
  kk: {
    fullName: "Әлия Серікқызы Ахметова",
    slug: "aliya-akhmetova-kk",
    position: "Ғылыми қызметкер",
    academicDegree: "PhD",
    shortBio: "Жаңа материалдар мен өңірлік технологияларды зерттеуші.",
    biography: "Әлия жаңа материалдарды зерттеп, өңірдегі ғылыми жобаларды дамытуға үлес қосады.",
  },
} as const;

describe("scientist validation", () => {
  it("accepts a complete bilingual profile", () => {
    expect(scientistInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects malformed ORCID", () => {
    expect(scientistInputSchema.safeParse({ ...validInput, orcid: "123" }).success).toBe(false);
  });

  it("rejects duplicate scientific fields", () => {
    const id = "f3576689-3d41-43f6-a17d-56bca5d9dc18";
    expect(scientistInputSchema.safeParse({ ...validInput, fieldIds: [id, id] }).success).toBe(false);
  });

  it("rejects unsafe catalog filters", () => {
    expect(publicScientistFiltersSchema.safeParse({ locale: "ru", query: "", organization: "../admin", field: "" }).success).toBe(false);
  });
});

describe("scientist extended input", () => {
  it("keeps safe defaults for legacy create inputs and accepts typed collaboration and links", () => {
    expect(scientistInputSchema.parse(validInput)).toMatchObject({isPublic:true,collaboration:{},links:[]});
    expect(scientistInputSchema.safeParse({...validInput,isPublic:false,collaboration:{mentoring:true},links:[{type:"scopus",url:"https://www.scopus.com/authid/detail.uri?authorId=1"}]}).success).toBe(true);
  });
  it.each(["not a URL", "javascript:alert(1)","https://scholar.google.com.evil.test/profile","https://user:password@scholar.google.com/profile"])("rejects unsafe or misclassified scientist link %s", url => {
    expect(scientistInputSchema.safeParse({...validInput,links:[{type:"google_scholar",url}]}).success).toBe(false);
  });
  it("rejects duplicate link types and unrecognized collaboration keys", () => {
    expect(scientistInputSchema.safeParse({...validInput,links:[{type:"website",url:"https://example.kz"},{type:"website",url:"https://other.kz"}]}).success).toBe(false);
    expect(scientistInputSchema.safeParse({...validInput,collaboration:{unknown:true}}).success).toBe(false);
  });
  it("requires a reason for rejection and distinct valid merge identities", () => {
    expect(scientistVerificationSchema.safeParse({status:"rejected",expectedVersion:1,note:""}).success).toBe(false);
    expect(scientistVerificationSchema.safeParse({status:"pending",expectedVersion:1,note:""}).success).toBe(true);
    const id="00000000-0000-4000-a000-000000000010";
    expect(scientistMergeSchema.safeParse({sourceId:id,targetId:id,sourceVersion:1,targetVersion:1,reason:"Confirmed duplicate."}).success).toBe(false);
  });
});
