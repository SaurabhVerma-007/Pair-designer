import { useState, useRef, useEffect } from "react";
import { ArrowUp, StopCircle } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (content.trim() && !isStreaming) {
      onSend(content.trim());
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  return (
    <div className="relative max-w-4xl mx-auto w-full pt-4 pb-6 px-4 sm:px-6 md:px-8">
      <div className="relative flex flex-col w-full bg-zinc-800/50 backdrop-blur-md border border-zinc-700/50 rounded-2xl shadow-xl shadow-black/20 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all duration-200 overflow-hidden">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Pair Designer to architect a system..."
          className="w-full bg-transparent border-none resize-none px-5 py-4 text-zinc-100 placeholder:text-zinc-500 focus:ring-0 sm:text-base outline-none max-h-[200px]"
          rows={1}
          disabled={isStreaming}
        />
        
        <div className="flex justify-between items-center px-3 py-2 border-t border-zinc-800/50 bg-zinc-900/30">
          <span className="text-xs text-zinc-500 font-medium px-2">
            {content.length} characters
          </span>
          
          <button
            onClick={isStreaming ? undefined : handleSend}
            disabled={!content.trim() && !isStreaming}
            className={`
              p-2.5 rounded-xl flex items-center justify-center transition-all duration-200
              ${isStreaming 
                ? "bg-zinc-700 text-zinc-400 cursor-not-allowed" 
                : content.trim() 
                  ? "bg-primary text-primary-foreground hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0" 
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"}
            `}
          >
            {isStreaming ? <StopCircle className="w-5 h-5 animate-pulse" /> : <ArrowUp className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <div className="text-center mt-3">
        <span className="text-xs text-zinc-500">Pair Designer can make mistakes. Consider verifying important architecture choices.</span>
      </div>
    </div>
  );
}
