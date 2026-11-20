import { z } from "zod";

export const notificationLocaleSchema = z.enum(["ru", "kk", "en"]);
export const notificationPageSchema = z.object({
  total: z.number().int().nonnegative(), unread: z.number().int().nonnegative(),
  page: z.number().int().positive(), pageSize: z.literal(20),
  items: z.array(z.object({
    id: z.uuid(), type: z.enum(["application_received", "application_status", "manager_new_request", "assignment"]),
    locale: notificationLocaleSchema, title: z.string().min(1).max(240), message: z.string().min(1).max(1000),
    url: z.string().startsWith("/").max(500), readAt: z.string().nullable(), createdAt: z.string(),
  })).max(20),
});
export type NotificationPage = z.infer<typeof notificationPageSchema>;
