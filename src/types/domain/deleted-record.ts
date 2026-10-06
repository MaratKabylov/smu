export type DeletedRecord = {
  id: string;
  kind: "article" | "scientist";
  titleRu: string | null;
  titleKk: string | null;
  status: string;
  deletedAt: string;
};
