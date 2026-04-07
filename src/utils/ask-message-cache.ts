import NodeCache from "node-cache";
import { Message } from "discord.js";

interface AskMessageRef {
  channelId: string;
  messageId: string;
}

interface AskMessageEntry {
  userId: string;
  refs: AskMessageRef[];
}

// 2-hour TTL matching the conversation Redis cache
const cache = new NodeCache({ stdTTL: 7200 });

export function storeAskMessages(conversationId: string, userId: string, messages: Message[]): void {
  cache.set(conversationId, {
    userId,
    refs: messages.map((m) => ({ channelId: m.channelId, messageId: m.id })),
  } satisfies AskMessageEntry);
}

export function getAskMessages(conversationId: string): AskMessageEntry | undefined {
  return cache.get<AskMessageEntry>(conversationId);
}

export function deleteAskMessages(conversationId: string): void {
  cache.del(conversationId);
}
