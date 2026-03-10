import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useChatStream(conversationId: number | null) {
  const queryClient = useQueryClient();
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, targetId: number | null = conversationId) => {
    if (!targetId) return;

    // Cancel any existing stream
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsStreaming(true);
    setStreamingText("");
    setError(null);

    try {
      const res = await fetch(`/api/conversations/${targetId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        credentials: "include",
        signal: abortControllerRef.current.signal,
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
                break;
              }
            } catch (err) {
              console.error("Failed to parse SSE chunk", dataStr, err);
            }
          }
        }
      }
    } catch (err) {
      // Don't show error for user-initiated cancellations
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Stream aborted by user');
        return;
      }
      setError(err instanceof Error ? err.message : "An error occurred during generation");
    } finally {
      setIsStreaming(false);

      // Clear streaming text after a short delay to allow UI to update
      setTimeout(() => {
        setStreamingText("");
      }, 100);

      // Invalidate queries to refetch updated conversation
      queryClient.invalidateQueries({ queryKey: [api.conversations.get.path, targetId] });
      queryClient.invalidateQueries({ queryKey: [api.conversations.list.path] });
    }
  }, [conversationId, queryClient]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setStreamingText("");
    }
  }, []);

  return { sendMessage, cancelStream, streamingText, isStreaming, error };
}