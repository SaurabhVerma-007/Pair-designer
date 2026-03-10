import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type ConversationCreateInput } from "@shared/routes";
import type { Conversation } from "@shared/schema";

function parseWithLogging<T>(schema: any, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data as T;
}

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: [api.conversations.list.path],
    queryFn: async () => {
      const res = await fetch(api.conversations.list.path, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch conversations");

      const data = await res.json();

      return parseWithLogging<Conversation[]>(
        api.conversations.list.responses[200],
        data,
        "conversations.list"
      );
    },
  });
}

export function useConversation(id: number | null) {
  return useQuery<Conversation | null>({
    queryKey: [api.conversations.get.path, id],
    queryFn: async () => {
      if (!id) return null;

      const url = buildUrl(api.conversations.get.path, { id });

      const res = await fetch(url, {
        credentials: "include",
      });

      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch conversation");

      const data = await res.json();

      return parseWithLogging<Conversation>(
        api.conversations.get.responses[200],
        data,
        "conversations.get"
      );
    },
    enabled: id !== null,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConversationCreateInput) => {
      const validated = api.conversations.create.input.parse(input);

      const res = await fetch(api.conversations.create.path, {
        method: api.conversations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to create conversation");

      const data = await res.json();

      return parseWithLogging<Conversation>(
        api.conversations.create.responses[201],
        data,
        "conversations.create"
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [api.conversations.list.path],
      });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.conversations.delete.path, { id });

      const res = await fetch(url, {
        method: api.conversations.delete.method,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete conversation");
    },

    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: [api.conversations.list.path],
      });

      queryClient.removeQueries({
        queryKey: [api.conversations.get.path, id],
      });
    },
  });
}