export const supportKinds = [
  "research_proposal",
  "it_request",
  "publication_support",
  "open_data_offer",
  "open_data_request",
] as const;

export const hubSupportKinds = [
  "research_proposal",
  "it_request",
  "publication_support",
] as const;

export const supportStatuses = [
  "new",
  "in_review",
  "in_progress",
  "completed",
  "rejected",
] as const;

export const supportPriorities = ["low", "normal", "high"] as const;

export type SupportKind = (typeof supportKinds)[number];
export type HubSupportKind = (typeof hubSupportKinds)[number];

export function isOpenDataSupportKind(kind: SupportKind): boolean {
  return kind === "open_data_offer" || kind === "open_data_request";
}

export function supportAllowsFiles(kind: SupportKind): boolean {
  return !isOpenDataSupportKind(kind);
}

export const supportFields = {
  research_proposal: ["importance", "region", "availableData"],
  it_request: ["currentProcess", "desiredSolution", "dataDescription"],
  publication_support: ["journal", "manuscriptStage", "supportNeeded"],
  open_data_offer: ["category", "dataFormat", "periodAndSource"],
  open_data_request: ["requestedData", "researchGoal", "periodOrFormat"],
} as const;

export const supportPermissions = {
  research_proposal: "research_proposals.manage",
  it_request: "it_requests.manage",
  publication_support: "publication_support.manage",
  open_data_offer: "open_data_offers.manage",
  open_data_request: "open_data_requests.manage",
} as const;

export const SUPPORT_FILE_MAX_BYTES = 1024 * 1024;
