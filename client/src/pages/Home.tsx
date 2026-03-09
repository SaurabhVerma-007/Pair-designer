import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Sidebar, APP_MODES } from "@/components/Sidebar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { useConversation, useCreateConversation } from "@/hooks/use-conversations";
import { useChatStream } from "@/hooks/use-chat";
import { Download, Loader2, Sparkles, Code2, Database } from "lucide-react";

interface Message {
  role: string;
  content: string;
}

interface Conversation {
  id: number;
  title: string;
  mode: string;
  messages: Message[];
}

export function Home() {
  const [match, params] = useRoute("/c/:id");
  const [, setLocation] = useLocation();
  const conversationId = match ? parseInt(params.id, 10) : null;

  const { data: conversationData, isLoading } = useConversation(conversationId);
  const conversation = conversationData as Conversation | undefined;

  const createMutation = useCreateConversation();
  const { sendMessage, streamingText, isStreaming } = useChatStream(conversationId);

  const [selectedMode, setSelectedMode] = useState<string>("design");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, streamingText]);

  const handleSend = async (content: string) => {
    if (conversationId) {
      await sendMessage(content, conversationId);
    } else {
      // First message: Create conversation then send
      const newConv = await createMutation.mutateAsync({
        title: content.slice(0, 30) + (content.length > 30 ? "..." : ""),
        mode: selectedMode,
      }) as Conversation;

      setLocation(`/c/${newConv.id}`);
      setTimeout(() => {
        sendMessage(content, newConv.id);
      }, 50);
    }
  };

  const handleDownload = () => {
    if (!conversation?.messages?.length) return;

    const content = conversation.messages
      .map((m: Message) => `### ${m.role === 'user' ? 'USER' : 'PAIR DESIGNER'}\n\n${m.content}\n\n`)
      .join('---\n\n');

    const blob = new Blob(
      [`# ${conversation.title}\n\nMode: ${conversation.mode}\n\n---\n\n${content}`],
      { type: 'text/markdown' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentModeInfo = APP_MODES.find(m => m.id === (conversation?.mode || selectedMode));

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-200 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-3">
            {currentModeInfo && (
              <div className="flex items-center gap-2 bg-zinc-900 text-zinc-300 px-3 py-1.5 rounded-full text-sm font-medium border border-zinc-800 shadow-sm">
                <currentModeInfo.icon className="w-4 h-4 text-primary" />
                <span>{currentModeInfo.label}</span>
              </div>
            )}
            {conversation && (
              <h2 className="text-zinc-400 font-medium truncate max-w-md hidden md:block">
                {conversation.title}
              </h2>
            )}
          </div>

          {conversation?.messages && conversation.messages.length > 0 && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-800 transition-colors shadow-sm"
              title="Download Markdown"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !conversationId ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center p-8 max-w-3xl mx-auto w-full">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center shadow-xl shadow-primary/20 mb-8 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                <Sparkles className="w-8 h-8 text-white" />
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold text-center mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-500">
                Software Architecture Assistant
              </h1>
              <p className="text-zinc-400 text-center mb-12 max-w-xl text-lg">
                Design, review, and scale your systems. Let's build robust architectures together.
              </p>

              {/* Mode Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full mb-12">
                {APP_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`
                      flex flex-col items-start p-4 rounded-xl border transition-all duration-200 text-left
                      ${selectedMode === mode.id
                        ? "bg-primary/10 border-primary shadow-lg shadow-primary/5"
                        : "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700"}
                    `}
                  >
                    <mode.icon className={`w-6 h-6 mb-3 ${selectedMode === mode.id ? "text-primary" : "text-zinc-400"}`} />
                    <span className="font-semibold text-zinc-200 mb-1">{mode.label}</span>
                    <span className="text-xs text-zinc-500">{mode.desc}</span>
                  </button>
                ))}
              </div>

              {/* Example Prompts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <button
                  onClick={() => handleSend("Design a microservices architecture for a real-time e-commerce platform including order processing and inventory management.")}
                  className="text-left p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 transition-colors group"
                >
                  <div className="flex items-center gap-2 text-primary mb-2 font-medium">
                    <Code2 className="w-4 h-4" /> E-Commerce System
                  </div>
                  <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                    Design a microservices architecture for a real-time e-commerce platform.
                  </p>
                </button>
                <button
                  onClick={() => handleSend("Compare Redis, Memcached, and Dragonfly for a high-throughput caching layer.")}
                  className="text-left p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 transition-colors group"
                >
                  <div className="flex items-center gap-2 text-indigo-400 mb-2 font-medium">
                    <Database className="w-4 h-4" /> Cache Comparison
                  </div>
                  <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                    Compare Redis, Memcached, and Dragonfly for high-throughput.
                  </p>
                </button>
              </div>
            </div>
          ) : (
            /* Message List */
            <div className="pb-10">
              {conversation?.messages?.map((msg: Message, idx: number) => (
                <MessageBubble
                  key={idx}
                  role={msg.role as 'user' | 'assistant'}
                  content={msg.content}
                />
              ))}

              {/* Streaming AI Bubble */}
              {isStreaming && (
                <MessageBubble role="assistant" content={streamingText || "▋"} />
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent pt-10">
          <ChatInput onSend={handleSend} isStreaming={isStreaming} />
        </div>
      </main>
    </div>
  );
}
