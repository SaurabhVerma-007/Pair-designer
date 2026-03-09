import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useChatStream(conversationId: number | null) {
  const queryClient = useQueryClient();
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string, targetId: number | null = conversationId) => {
    if (!targetId) return;
    
    setIsStreaming(true);
    setStreamingText("");
    setError(null);

    try {
      const res = await fetch(`/api/conversations/${targetId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream available");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim().startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                setStreamingText((prev) => prev + data.content);
              }
              if (data.error) {
                setError(data.error);
              }
              if (data.done) {
                // Done parsing stream
                break;
              }
            } catch (err) {
              console.error("Failed to parse SSE chunk", dataStr, err);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during generation");
    } finally {
      setIsStreaming(false);
      // Invalidate the specific conversation to refetch the full message history
      queryClient.invalidateQueries({ queryKey: [api.conversations.get.path, targetId] });
      // Invalidate list to update timestamps/previews if applicable
      queryClient.invalidateQueries({ queryKey: [api.conversations.list.path] });
    }
  }, [conversationId, queryClient]);

  return { sendMessage, streamingText, isStreaming, error };
}
