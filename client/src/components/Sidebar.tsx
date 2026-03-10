import type { Conversation } from "@shared/schema";
import { useConversations, useDeleteConversation } from "@/hooks/use-conversations";
import { Plus, MessageSquare, Trash2, LayoutTemplate, Glasses, GitCompare, Scaling, ShieldAlert, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";

export const APP_MODES = [
  { id: "design", label: "Design New System", icon: LayoutTemplate, desc: "Architect from scratch" },
  { id: "review", label: "Review Design", icon: Glasses, desc: "Analyze existing plans" },
  { id: "compare", label: "Compare Options", icon: GitCompare, desc: "Evaluate trade-offs" },
  { id: "scale", label: "Scale Planning", icon: Scaling, desc: "Prepare for high traffic" },
  { id: "failure", label: "Failure Analysis", icon: ShieldAlert, desc: "Find single points of failure" },
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { data: conversations, isLoading } = useConversations();
  const deleteMutation = useDeleteConversation();

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this conversation?")) {
      await deleteMutation.mutateAsync(id);
      if (location === `/c/${id}`) {
        setLocation("/");
      }
    }
  };

  return (
    <div className="w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full shrink-0">
      <div className="p-4">
        <Link
          href="/"
          className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-3 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200 active:translate-y-0 w-full"
        >
          <Plus className="w-5 h-5" />
          <span>New Session</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">
          Recent Sessions
        </h3>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
          </div>
        ) : conversations?.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-4 px-2">
            No conversations yet. Start a new session to begin.
          </div>
        ) : (
          <div className="space-y-1">
            {conversations?.map((conv) => {
              const isActive = location === `/c/${conv.id}`;
              const ModeIcon = APP_MODES.find(m => m.id === conv.mode)?.icon || MessageSquare;

              return (
                <Link
                  key={conv.id}
                  href={`/c/${conv.id}`}
                  className={`
                    group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                    ${isActive
                      ? "bg-zinc-800 text-zinc-100 shadow-sm"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"}
                  `}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <ModeIcon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-zinc-500"}`} />
                    <span className="truncate pr-2 font-medium">{conv.title}</span>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-red-400 transition-all shrink-0"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-indigo-400 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-sm">PD</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-200">Pair Designer</div>
            <div className="text-xs text-zinc-500">AI Architect</div>
          </div>
        </div>
      </div>
    </div>
  );
}
