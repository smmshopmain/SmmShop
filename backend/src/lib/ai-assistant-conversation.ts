import { AIAssistantChat, AIAssistantConversation } from "@/models";
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

export type AssistantConversation = {
  id: string;
  title: string;
  messages: AssistantConversationMessage[];
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AssistantConversationSummary = Omit<AssistantConversation, "messages">;

const MAX_STORED_MESSAGES = 500;
const DEFAULT_PAGE_SIZE = 50;

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

function toISOString(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function getConversationTitle(messages: AssistantConversationMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) return "New chat";
  const title = firstUserMessage.content
    .replace(/\n\nUploaded (?:email campaign banner|website popup image) URL:\s*\S+/gi, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return "New chat";
  return title.length > 77 ? `${title.slice(0, 76).trimEnd()}…` : title;
}

function mapConversation(value: unknown): AssistantConversation {
  if (
    !value ||
    typeof value !== "object" ||
    !("_id" in value) ||
    !("messages" in value)
  ) {
    throw new Error("AI assistant conversation history is invalid.");
  }
  const messages = parseStoredMessages(value.messages);
  const title = "title" in value && typeof value.title === "string"
    ? value.title
    : getConversationTitle(messages);
  const messageCount = "messageCount" in value && typeof value.messageCount === "number"
    ? value.messageCount
    : messages.length;
  return {
    id: String(value._id),
    title,
    messages,
    messageCount,
    createdAt: toISOString("createdAt" in value ? value.createdAt : undefined),
    updatedAt: toISOString("updatedAt" in value ? value.updatedAt : undefined),
  };
}

async function migrateLegacyConversation(identity: AssistantConversationIdentity) {
  const filter = getConversationFilter(identity);
  const legacy = await AIAssistantConversation.findOne(filter).lean();
  if (!legacy) return;
  if (await AIAssistantChat.exists({ _id: legacy._id, ...filter })) return;

  const messages = parseStoredMessages(legacy.messages);
  try {
    await AIAssistantChat.create({
      _id: legacy._id,
      ...filter,
      title: getConversationTitle(messages),
      messageCount: messages.length,
      messages,
      createdAt: legacy.createdAt ?? new Date(),
      updatedAt: legacy.updatedAt ?? new Date(),
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
}

export async function listAssistantConversations(
  identity: AssistantConversationIdentity,
  offset = 0,
  requestedLimit = DEFAULT_PAGE_SIZE,
) {
  await migrateLegacyConversation(identity);
  const filter = { ...getConversationFilter(identity), messageCount: { $gt: 1 } };
  const safeOffset = Math.max(0, Math.floor(offset));
  const limit = Math.min(100, Math.max(1, Math.floor(requestedLimit)));
  const [conversations, total] = await Promise.all([
    AIAssistantChat.find(filter)
      .select("title messageCount createdAt updatedAt")
      .sort({ updatedAt: -1, _id: -1 })
      .skip(safeOffset)
      .limit(limit)
      .lean(),
    AIAssistantChat.countDocuments(filter),
  ]);
  return {
    conversations: conversations.map((conversation) => ({
      id: String(conversation._id),
      title: conversation.title,
      messageCount: conversation.messageCount,
      createdAt: toISOString(conversation.createdAt),
      updatedAt: toISOString(conversation.updatedAt),
    })),
    total,
    nextOffset: safeOffset + conversations.length < total ? safeOffset + conversations.length : null,
  };
}

export async function createAssistantConversation(
  identity: AssistantConversationIdentity,
  creationRequestId?: string,
) {
  await migrateLegacyConversation(identity);
  const filter = getConversationFilter(identity);
  if (creationRequestId) {
    const existing = await AIAssistantChat.findOne({ ...filter, creationRequestId }).lean();
    if (existing) return mapConversation(existing);
  }
  try {
    const conversation = await AIAssistantChat.create({
      ...filter,
      creationRequestId,
      title: "New chat",
      messageCount: 1,
      messages: [{ role: "assistant", content: getGreeting(identity) }],
    });
    return mapConversation(conversation.toObject());
  } catch (error) {
    if (!creationRequestId || !isDuplicateKeyError(error)) throw error;
    const existing = await AIAssistantChat.findOne({ ...filter, creationRequestId }).lean();
    if (!existing) throw error;
    return mapConversation(existing);
  }
}

export async function getAssistantConversation(
  identity: AssistantConversationIdentity,
  conversationId?: string,
): Promise<AssistantConversation> {
  await migrateLegacyConversation(identity);
  const filter = getConversationFilter(identity);
  const conversation = conversationId
    ? await AIAssistantChat.findOne({ ...filter, _id: conversationId }).lean()
    : await AIAssistantChat.findOne(filter).sort({ updatedAt: -1, _id: -1 }).lean();
  if (conversation) return mapConversation(conversation);
  if (conversationId) throw new Error("Conversation not found.");
  return createAssistantConversation(identity);
}

export async function appendAssistantConversationMessages(
  identity: AssistantConversationIdentity,
  conversationId: string | undefined,
  messages: AssistantConversationMessage[],
) {
  if (messages.length === 0) return;

  const conversation = await getAssistantConversation(identity, conversationId);
  const hasUserMessage = conversation.messages.some((message) => message.role === "user");
  const firstNewUserMessage = messages.find((message) => message.role === "user");
  const update: Record<string, unknown> = {
    $push: {
      messages: {
        $each: messages,
        $slice: -MAX_STORED_MESSAGES,
      },
    },
    $inc: { messageCount: messages.length },
  };
  if (!hasUserMessage && firstNewUserMessage) {
    update.$set = { title: getConversationTitle([firstNewUserMessage]) };
  }

  const result = await AIAssistantChat.updateOne(
    { ...getConversationFilter(identity), _id: conversation.id },
    update,
  );
  if (result.matchedCount !== 1) {
    throw new Error("Unable to save AI assistant conversation history.");
  }
}
