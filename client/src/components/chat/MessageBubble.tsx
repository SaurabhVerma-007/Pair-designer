import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { MermaidDiagram } from "./MermaidDiagram";
import { Copy, Check, Bot, User } from "lucide-react";
import { useState } from "react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`py-8 ${isUser ? "" : "bg-zinc-900/30 border-y border-zinc-800/50"
        }`}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 flex gap-5">
        {/* Avatar */}
        <div
          className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center shadow-sm ${isUser
              ? "bg-zinc-700 text-zinc-200"
              : "bg-primary/20 text-primary border border-primary/30"
            }`}
        >
          {isUser ? (
            <User className="w-5 h-5" />
          ) : (
            <Bot className="w-5 h-5" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <div className="font-semibold text-sm text-zinc-300">
              {isUser ? "You" : "Pair Designer"}
            </div>

            {!isUser && (
              <button
                onClick={handleCopy}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition-colors flex items-center gap-1.5 text-xs font-medium"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {copied ? "Copied" : "Copy"}
                </span>
              </button>
            )}
          </div>

          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const rawLanguage = match ? match[1] : "";
                  const language = rawLanguage.toLowerCase();
                  const text = String(children).replace(/\n$/, "");

                  // ✅ Hardened Mermaid detection
                  if (!inline && language === "mermaid") {
                    return <MermaidDiagram chart={text} />;
                  }

                  // ✅ Syntax highlighting for other languages
                  if (!inline && language) {
                    return (
                      <div className="my-5 rounded-lg overflow-hidden border border-zinc-800 shadow-lg bg-[#1E1E1E]">
                        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                            {language}
                          </span>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(text)
                            }
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="Copy code"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus as any}
                          language={language}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            padding: "1rem",
                            background: "transparent",
                          }}
                          {...props}
                        >
                          {text}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }

                  // Inline code
                  return (
                    <code
                      className="bg-zinc-800 px-1.5 py-0.5 rounded text-primary-foreground/90 font-mono text-[0.9em]"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}