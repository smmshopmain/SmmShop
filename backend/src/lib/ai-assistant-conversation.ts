import { AIAssistantConversation } from "@/models";
import { isAdminRole, type UserRole } from "@/lib/roles";

export type AssistantConversationIdentity = {
  id: string;
  name: string;
  role: UserRole;
  authSource?: "environment" | "database";
};

export type AssistantConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssistantConversation = {
  messages: AssistantConversationMessage[];
};

const MAX_STORED_MESSAGES = 500;

function getConversationScope(identity: AssistantConversationIdentity) {
  return isAdminRole(identity.role) ? "admin" : "user";
}

function getConversationFilter(identity: AssistantConversationIdentity) {
  const identityType = identity.authSource === "environment" ? "environment" : "account";
  return {
    owner: `${identityType}:${identity.id}`,
    scope: getConversationScope(identity),
  };
}

function getGreeting(identity: AssistantConversationIdentity) {
  const name = identity.name
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "there";

  return getConversationScope(identity) === "admin"
    ? `Hi ${name}! I'm your admin assistant. What would you like to manage today?`
    : `Hi ${name}! I can help with your services, orders, account, and support. What do you need today?`;
}

function isDuplicateKeyError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000,
  );
}

function parseStoredMessages(value: unknown): AssistantConversationMessage[] {
  if (!Array.isArray(value)) throw new Error("AI assistant conversation history is invalid.");
  const messages: AssistantConversationMessage[] = [];
  for (const message of value) {
    if (
      !message ||
      typeof message !== "object" ||
      !("role" in message) ||
      (message.role !== "user" && message.role !== "assistant") ||
      !("content" in message) ||
      typeof message.content !== "string"
    ) {
      throw new Error("AI assistant conversation history contains an invalid message.");
    }
    messages.push({ role: message.role, content: message.content });
  }
  return messages;
}

function mapConversation(value: unknown): AssistantConversation {
  if (!value || typeof value !== "object" || !("messages" in value)) {
    throw new Error("AI assistant conversation history is invalid.");
  }
  return { messages: parseStoredMessages(value.messages) };
}

export async function getAssistantConversation(identity: AssistantConversationIdentity): Promise<AssistantConversation> {
  const filter = getConversationFilter(identity);
  let conversation = await AIAssistantConversation.findOne(filter).lean();
  if (conversation) return mapConversation(conversation);

  try {
    await AIAssistantConversation.create({
      ...filter,
      messages: [{ role: "assistant", content: getGreeting(identity) }],
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }

  conversation = await AIAssistantConversation.findOne(filter).lean();
  if (!conversation) throw new Error("Unable to load AI assistant conversation history.");
  return mapConversation(conversation);
}

export async function appendAssistantConversationMessages(
  identity: AssistantConversationIdentity,
  messages: AssistantConversationMessage[],
) {
  if (messages.length === 0) return;

  await getAssistantConversation(identity);
  const result = await AIAssistantConversation.updateOne(
    getConversationFilter(identity),
    {
      $push: {
        messages: {
          $each: messages,
          $slice: -MAX_STORED_MESSAGES,
        },
      },
    },
  );
  if (result.matchedCount !== 1) {
    throw new Error("Unable to save AI assistant conversation history.");
  }
}
