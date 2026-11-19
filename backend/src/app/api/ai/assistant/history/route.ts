import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { currentUser, requireAdmin, requireUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import {
  createAssistantConversation,
  getAssistantConversation,
  listAssistantConversations,
} from "@/lib/ai-assistant-conversation";
import { isAdminRole } from "@/lib/roles";
import { getSettings } from "@/models";

const createConversationSchema = z.object({
  requestId: z.string().uuid().optional(),
}).strict();

async function getAssistantIdentity() {
  const current = await currentUser();
  if (!current) throw new Error("Unauthorized");
  if (isAdminRole(current.role)) return (await requireAdmin()).auth;
  return (await requireUser()).auth;
}

export async function GET(request: NextRequest) {
  try {
    const identity = await getAssistantIdentity();
    await dbConnect();
    const settings = await getSettings();
    if (!settings.ai.enabled) return fail("AI assistant is disabled.", 404);

    const conversationId = request.nextUrl.searchParams.get("conversationId");
    if (conversationId) {
      if (!/^[a-f\d]{24}$/i.test(conversationId)) return fail("Invalid conversation ID.", 400);
      const conversation = await getAssistantConversation(identity, conversationId);
      return ok({
        conversationId: conversation.id,
        title: conversation.title,
        messages: conversation.messages,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (request.nextUrl.searchParams.get("list") === "1") {
      const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
      const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1) {
        return fail("Invalid conversation history page.", 400);
      }
      const history = await listAssistantConversations(identity, offset, limit);
      return ok(history, { headers: { "Cache-Control": "private, no-store" } });
    }

    const conversation = await getAssistantConversation(identity);
    return ok({
      conversationId: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load AI assistant history.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message === "Conversation not found." ? 404 : 400;
    return fail(message, status);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await getAssistantIdentity();
    await dbConnect();
    const settings = await getSettings();
    if (!settings.ai.enabled) return fail("AI assistant is disabled.", 404);
    const input = await parseBody(request, createConversationSchema);
    if (!await rateLimit(`ai-assistant-chat:${identity.id}`, 20, 60_000)) {
      return fail("Too many new chats. Please wait a minute and try again.", 429);
    }

    const conversation = await createAssistantConversation(identity, input.requestId);
    return ok({
      conversationId: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start a new AI assistant chat.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return fail(message, status);
  }
}
