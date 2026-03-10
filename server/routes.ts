import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import Groq from "groq-sdk";
import { SYSTEM_PROMPT, getModeContext } from "./config/prompts";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Input validation schema
const sendMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(10000, "Message too long"),
});

// Configuration constants
const MAX_CONTEXT_MESSAGES = 10; // Keep last 10 messages for context (prevents memory leak)

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all conversations
  app.get(api.conversations.list.path, async (req, res) => {
    try {
      const result = await storage.getConversations();
      res.json(result);
    } catch (error) {
      console.error("Error listing conversations:", error);
      res.status(500).json({ message: "Failed to list conversations" });
    }
  });

  // Get single conversation
  app.get(api.conversations.get.path, async (req, res) => {
    try {
      const result = await storage.getConversation(Number(req.params.id));
      if (!result) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      res.json(result);
    } catch (error) {
      console.error("Error getting conversation:", error);
      res.status(500).json({ message: "Failed to get conversation" });
    }
  });

  // Create new conversation
  app.post(api.conversations.create.path, async (req, res) => {
    try {
      const input = api.conversations.create.input.parse(req.body);
      const result = await storage.createConversation(input);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Error creating conversation:", err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete conversation
  app.delete(api.conversations.delete.path, async (req, res) => {
    try {
      await storage.deleteConversation(Number(req.params.id));
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // Send message (streaming endpoint)
  app.post('/api/conversations/:id/messages', async (req, res) => {
    try {
      const conversationId = Number(req.params.id);

      // Validate conversation ID
      if (isNaN(conversationId) || conversationId <= 0) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }

      // Validate input
      const parseResult = sendMessageSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: parseResult.error.errors[0].message,
          field: parseResult.error.errors[0].path.join('.'),
        });
      }

      const { content } = parseResult.data;

      // Get conversation
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Save user message
      await storage.createMessage({
        conversationId,
        role: "user",
        content,
      });

      // Prepare context with sliding window (only last N messages)
      const recentMessages = conversation.messages.slice(-MAX_CONTEXT_MESSAGES);
      const messages = recentMessages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));
      messages.push({ role: "user", content });

      // Get mode-specific context
      const modeContext = getModeContext(conversation.mode);

      // Setup SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

      let fullResponse = "";

      try {
        // Create streaming completion
        const stream = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + modeContext },
            ...messages
          ],
          temperature: 0.2,
          max_tokens: 4096,
          stream: true,
        });

        // Stream chunks to client
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            fullResponse += delta;
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        }

        // Save assistant message to database
        await storage.createMessage({
          conversationId,
          role: "assistant",
          content: fullResponse,
        });

        // Send completion signal
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();

      } catch (streamError) {
        console.error("Groq streaming error:", streamError);

        // Send error to client via SSE
        const errorMessage = streamError instanceof Error
          ? streamError.message
          : "Unknown streaming error";

        res.write(`data: ${JSON.stringify({
          error: "AI service temporarily unavailable. Please try again.",
          details: errorMessage
        })}\n\n`);
        res.end();
      }

    } catch (error) {
      console.error("Error in message endpoint:", error);

      // If headers not sent, send JSON error
      if (!res.headersSent) {
        res.status(500).json({
          error: "Failed to process message",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      } else {
        // If streaming already started, send error via SSE
        res.write(`data: ${JSON.stringify({
          error: "Server error occurred"
        })}\n\n`);
        res.end();
      }
    }
  });

  return httpServer;
}