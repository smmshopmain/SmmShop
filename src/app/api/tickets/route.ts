import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody, requireUser } from "@/lib/api";
import { notifyInApp } from "@/lib/notifications";
import { Ticket } from "@/models";

const schema = z.object({
  subject: z.string().min(3).max(160),
  message: z.string().min(5).max(5000),
  priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
});

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["reply", "close"]),
  message: z.string().min(2).max(5000).optional(),
});

export async function GET() {
  try {
    const { auth } = await requireUser();
    const tickets = await Ticket.find({ user: auth.id }).sort({ createdAt: -1 }).lean();
    return ok({ tickets });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load tickets", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, schema);
    const { auth } = await requireUser();
    const ticket = await Ticket.create({
      user: auth.id,
      subject: input.subject,
      priority: input.priority,
      messages: [{ sender: auth.id, body: input.message }],
    });
    await notifyInApp({
      user: auth.id,
      title: "Ticket created",
      body: input.subject,
    });
    return ok({ ticket });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create ticket");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const input = await parseBody(request, patchSchema);
    const { auth } = await requireUser();
    const filter: Record<string, unknown> = { _id: input.id };
    if (auth.role !== "admin") filter.user = auth.id;

    const ticket = await Ticket.findOne(filter);
    if (!ticket) return fail("Ticket not found", 404);
    if (ticket.status === "Closed") return fail("Ticket is already closed");

    if (input.action === "reply") {
      if (!input.message) return fail("Reply message is required");
      ticket.messages.push({
        sender: auth.id,
        body: input.message,
        isAdmin: auth.role === "admin",
      });
      ticket.status = auth.role === "admin" ? "Answered" : "Open";
      await notifyInApp({
        user: ticket.user,
        title: auth.role === "admin" ? "Admin replied to your ticket" : "Ticket reply added",
        body: ticket.subject,
      });
    }

    if (input.action === "close") {
      ticket.status = "Closed";
      await notifyInApp({
        user: ticket.user,
        title: "Ticket closed",
        body: ticket.subject,
      });
    }

    await ticket.save();
    return ok({ ticket });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update ticket");
  }
}
