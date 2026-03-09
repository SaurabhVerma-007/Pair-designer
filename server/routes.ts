import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// 🔥 IMPROVED SYSTEM PROMPT - Based on quality improvement package
const SYSTEM_PROMPT = `You are a senior software architect. Your name is Pair Designer.

Core Principles:
1. Modeling Discipline: Never fabricate infrastructure numbers (instance counts, costs, etc.) without explicit mathematical derivation. 
2. Explicit Assumptions: Label all assumptions clearly.
3. Minimal Diagrams: Limit to exactly ONE minimal Mermaid diagram per response.
4. Architecturally Disciplined: Do not default to microservices. Justify all distributed system choices with traffic math (requests/sec, data volume) vs monolith complexity.

Structure:
- Requirements & Scale Assumptions (labeled)
- Modeling & Math (Show your work for capacity planning)
- Architecture Design (Monolith vs Microservices justification)
- Component Design & Data Flow
- Mermaid Diagram (1 max)
- Trade-offs & Recommendations

## Mathematical Validation Rules

Before finalizing any calculation:

1. Convert units step-by-step (KB → MB → GB).
2. Verify magnitude with sanity check.
3. Compare output to real-world bounds.
4. If result exceeds typical SaaS CRM patterns (e.g., >10GB/day per 200k DAU), re-evaluate assumptions.
5. Never round across unit boundaries without explicit conversion.

Mandatory Scale Depth Rules:

If DAU > 50,000:
1. Estimate peak concurrency.
2. Derive peak RPS.
3. Estimate DB QPS using query amplification.
4. Identify at least one likely bottleneck.
5. Evaluate operational impact of tenant isolation strategy.

If these are missing, the modeling section is incomplete.

Mermaid Rules:
- Start blocks with valid types (graph TD, sequenceDiagram, etc.)
- Use standard syntax only.
- No text outside the Mermaid block inside the code block.`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.conversations.list.path, async (req, res) => {
    const result = await storage.getConversations();
    res.json(result);
  });

  app.get(api.conversations.get.path, async (req, res) => {
    const result = await storage.getConversation(Number(req.params.id));
    if (!result) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    res.json(result);
  });

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
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete(api.conversations.delete.path, async (req, res) => {
    await storage.deleteConversation(Number(req.params.id));
    res.status(204).end();
  });

  // Chat endpoint (streaming)
  app.post('/api/conversations/:id/messages', async (req, res) => {
    try {
      const conversationId = Number(req.params.id);
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }

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

      // Prepare context for Groq
      const messages = conversation.messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));
      messages.push({ role: "user", content });

      // 🔥 Enhanced mode context
      let modeContext = "";
      if (conversation.mode === "design") {
        modeContext = "\n\nMode: Design New System. Focus on architecture diagrams, capacity planning, cost estimates, and deployment strategies.";
      } else if (conversation.mode === "review") {
        modeContext = "\n\nMode: Review Existing Design. Focus on identifying bottlenecks, profiling tools, code optimizations with before/after comparisons, and quick wins.";
      } else if (conversation.mode === "compare") {
        modeContext = "\n\nMode: Compare Options. Focus on detailed comparison tables with specific metrics, code examples for each option, and use-case recommendations.";
      } else if (conversation.mode === "scale") {
        modeContext = "\n\nMode: Scale Planning. Focus on current vs target capacity, resource calculations, auto-scaling configs, and cost projections.";
      } else if (conversation.mode === "optimize") {
        modeContext = "\n\nMode: Optimize Performance. Focus on profiling, specific optimizations with percentage improvements, and cost vs performance trade-offs.";
      } else if (conversation.mode === "debug") {
        modeContext = "\n\nMode: Debug Issues. Focus on diagnostic steps, root cause analysis, and specific fixes with verification steps.";
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + modeContext },
          ...messages
        ],
        temperature: 0.2,      // Lower temperature for more focused responses
        max_tokens: 4096,      // Allow longer, detailed responses
        stream: true,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullResponse += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }

      // Save assistant message
      await storage.createMessage({
        conversationId,
        role: "assistant",
        content: fullResponse,
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  return httpServer;
}