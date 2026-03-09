import { z } from 'zod';
import { insertConversationSchema, insertMessageSchema, conversations, messages } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

const messageSchema = z.custom<typeof messages.$inferSelect>();
const conversationSchema = z.custom<typeof conversations.$inferSelect>();

export const api = {
  conversations: {
    list: {
      method: 'GET' as const,
      path: '/api/conversations' as const,
      responses: {
        200: z.array(conversationSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/conversations/:id' as const,
      responses: {
        200: z.custom<import('./schema').ConversationWithMessages>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/conversations' as const,
      input: insertConversationSchema,
      responses: {
        201: conversationSchema,
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/conversations/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export const streams = {
  chat: {
    input: z.object({ content: z.string() }),
    chunk: z.object({ content: z.string().optional(), done: z.boolean().optional(), error: z.string().optional() }),
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type ConversationListResponse = z.infer<typeof api.conversations.list.responses[200]>;
export type ConversationGetResponse = z.infer<typeof api.conversations.get.responses[200]>;
export type ConversationCreateInput = z.infer<typeof api.conversations.create.input>;
export type StreamChatInput = z.infer<typeof streams.chat.input>;
