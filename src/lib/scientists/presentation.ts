import type { ScientistStatus } from "@/types/domain/scientist";

export const scientistStatusLabels: Record<ScientistStatus, string> = {
  draft: "Черновик",
  verified: "Верифицирован",
};
