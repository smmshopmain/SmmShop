import { Notification } from "@/models";

export async function notifyInApp({
  user,
  title,
  body,
}: {
  user?: unknown;
  title: string;
  body?: string;
}) {
  return Notification.create({
    user,
    channel: "in_app",
    title,
    body,
  });
}
