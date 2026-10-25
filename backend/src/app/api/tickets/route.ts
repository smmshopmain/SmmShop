import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { notifyInApp } from "@/lib/notifications";
import { isAdminRole } from "@/lib/roles";
import { ensureTelegramWebhook, notifyTelegram, supportTicketKeyboard } from "@/lib/telegram";
import { Ticket, User } from "@/models";

const schema = z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(5).max(5000),
  category: z.enum(["account", "order", "payment", "technical", "other"]).default("other"),
});

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["reply", "close", "reopen", "set_priority"]),
  message: z.string().trim().min(2).max(5000).optional(),
  priority: z.enum(["Low", "Medium", "High"]).optional(),
});

export async function GET() {
  try {
    const { auth } = await requireUser();
    const tickets = await Ticket.find({ user: auth.id }).sort({ updatedAt: -1 }).lean();
    return ok({ tickets });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load tickets", 401);
  }
}

function priorityForCategory(category: z.infer<typeof schema>["category"]) {
    if (category === "payment") return "High" as const;
    if (category === "other") return "Low" as const;
    return "Medium" as const;
}

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth } = await requireUser();
    const ticket = await Ticket.create({
      user: auth.id,
      subject: input.subject,
      category: input.category,
      priority: priorityForCategory(input.category),
      messages: [{ sender: auth.id, body: input.message }],
    });
    await notifyInApp({
      user: auth.id,
      title: "Ticket created",
      body: input.subject,
    });
    const user = await User.findById(auth.id).select("name email").lean();
    const webhookResult = await ensureTelegramWebhook(request.nextUrl.origin);
    if (!webhookResult || (
      typeof webhookResult === "object" &&
      "ok" in webhookResult &&
      webhookResult.ok !== true
    )) {
      console.error("Unable to configure Telegram webhook for support ticket controls.", {
        ticketId: String(ticket._id),
      });
    }
    await notifyTelegram("New support ticket", [
      `Ticket: ${String(ticket._id)}`,
      `From: ${user?.name ?? "User"} (${user?.email ?? auth.email})`,
      `Category: ${input.category}`,
      `Priority: ${input.priority}`,
      `Subject: ${input.subject}`,
      `Message: ${input.message.slice(0, 700)}`,
    ], supportTicketKeyboard(String(ticket._id), ticket.status, ticket.priority));
    return ok({ ticket });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create ticket");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const input = await parseBody(request, patchSchema);
    const { auth } = await requireUser();
    const isAdmin = isAdminRole(auth.role);
    const filter: Record<string, unknown> = { _id: input.id };
    if (!isAdmin) filter.user = auth.id;

    const ticket = await Ticket.findOne(filter);
    if (!ticket) return fail("Ticket not found", 404);
    if (input.action === "reply" && ticket.status === "Closed" && !isAdmin) {
      return fail("This request is closed. Contact support if you need more help.");
    }
    if (input.action === "reply") {
      if (!input.message) return fail("Reply message is required");
      ticket.messages.push({
        sender: auth.id,
        body: input.message,
        isAdmin,
      });
      ticket.status = isAdmin ? "Answered" : "Open";
    }

    if (input.action === "close") {
      if (ticket.status === "Closed") return fail("Ticket is already closed");
      ticket.status = "Closed";
    }

    if (input.action === "reopen") {
      if (!isAdmin) return fail("Only support staff can reopen a closed request.", 403);
      if (ticket.status !== "Closed") return fail("Ticket is not closed");
      ticket.status = "Open";
    }

    if (input.action === "set_priority") {
      if (!isAdmin) return fail("Only support staff can change ticket priority.", 403);
      if (!input.priority) return fail("Ticket priority is required");
      ticket.priority = input.priority;
    }

    await ticket.save();
    if (input.action === "reply" && isAdmin) {
      await notifyInApp({
        user: ticket.user,
        title: "Support replied to your ticket",
        body: ticket.subject,
      });
    } else if (input.action === "reply") {
      const user = await User.findById(auth.id).select("name email").lean();
      await notifyTelegram("Customer replied to a support ticket", [
        `Ticket: ${String(ticket._id)}`,
        `From: ${user?.name ?? "User"} (${user?.email ?? auth.email})`,
        `Subject: ${ticket.subject}`,
        `Message: ${input.message?.slice(0, 700) ?? ""}`,
      ], supportTicketKeyboard(String(ticket._id), ticket.status, ticket.priority));
    } else if (input.action === "close" && isAdmin) {
      await notifyInApp({
        user: ticket.user,
        title: "Support ticket closed",
        body: ticket.subject,
      });
    }
    return ok({ ticket });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update ticket");
  }
}
