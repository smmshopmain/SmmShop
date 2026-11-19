import { fail, ok } from "@/lib/api";
import { currentUser, requireAdmin, requireUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { getAssistantConversation } from "@/lib/ai-assistant-conversation";
import { isAdminRole } from "@/lib/roles";
import { getSettings } from "@/models";

async function getAssistantIdentity() {
  const current = await currentUser();
  if (!current) throw new Error("Unauthorized");
  if (isAdminRole(current.role)) return (await requireAdmin()).auth;
  return (await requireUser()).auth;
}

export async function GET() {
  try {
    const identity = await getAssistantIdentity();
    await dbConnect();
    const settings = await getSettings();
    if (!settings.ai.enabled) return fail("AI assistant is disabled.", 404);

    const conversation = await getAssistantConversation(identity);
    return ok({
      messages: conversation.messages.map(({ role, content }) => ({ role, content })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load AI assistant history.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return fail(message, status);
  }
}
