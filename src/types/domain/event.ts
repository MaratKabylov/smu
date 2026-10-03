import type { ScientistLocale } from "./scientist";

export const eventStatuses = ["draft", "published", "cancelled", "archived"] as const;
export type EventStatus = (typeof eventStatuses)[number];
export const eventFormats = ["offline", "online", "hybrid"] as const;
export type EventFormat = (typeof eventFormats)[number];
export const eventKinds = ["conference", "seminar", "workshop", "meetup"] as const;
export type EventKind = (typeof eventKinds)[number];
export type EventTranslation = {
  locale: ScientistLocale;
  title: string;
  slug: string;
  summary: string;
  description: string;
  organizer: string;
  location: string;
};
export type ScienceEvent = {
  id: string;
  status: EventStatus;
  kind: EventKind;
  format: EventFormat;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string | null;
  registrationUrl: string | null;
  externalUrl: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  updatedAt: string;
  translations: EventTranslation[];
};
