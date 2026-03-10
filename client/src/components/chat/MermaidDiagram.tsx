import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Maximize2, Minimize2 } from "lucide-react";
import { sanitizeMermaid } from "@/lib/mermaid-sanitizer";

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "Inter, sans-serif",
});

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      if (!containerRef.current || !chart) return;

      try {
        setError(null);

        // Sanitize the chart
        const cleanChart = sanitizeMermaid(chart);

        // Clear previous content
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        // Generate unique ID for each render to avoid conflicts
        const renderId = `${id.current}-${Date.now()}`;

        // Render the chart
        const { svg } = await mermaid.render(renderId, cleanChart);

        // Only update DOM if component is still mounted
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Mermaid rendering failed:", errorMessage);
        console.error("Original code:", chart);
        console.error("Sanitized code:", sanitizeMermaid(chart));

        setError(errorMessage);

        // Show error UI
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="text-red-400 p-4 border border-red-900/50 rounded bg-red-950/20 text-sm">
              <p class="font-bold mb-2 text-red-300">⚠️ Diagram Rendering Failed</p>
              <p class="text-xs text-red-400/80 mb-3">${errorMessage}</p>
              <details class="cursor-pointer">
                <summary class="text-xs text-zinc-400 hover:text-zinc-300 mb-2">View original code</summary>
                <pre class="text-xs whitespace-pre-wrap text-zinc-400 mt-2 p-2 bg-zinc-900/50 rounded overflow-x-auto">${chart}</pre>
              </details>
              <details class="cursor-pointer mt-2">
                <summary class="text-xs text-zinc-400 hover:text-zinc-300 mb-2">View sanitized code</summary>
                <pre class="text-xs whitespace-pre-wrap text-zinc-400 mt-2 p-2 bg-zinc-900/50 rounded overflow-x-auto">${sanitizeMermaid(chart)}</pre>
              </details>
            </div>
          `;
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const DiagramContent = () => (
    <div className="relative group mermaid-wrapper flex justify-center py-6 px-4 bg-zinc-900 rounded-xl border border-zinc-800 overflow-x-auto">
      <div
        ref={containerRef}
        className="min-w-full flex justify-center items-center"
      />
      {!error && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 p-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          title={isFullscreen ? "Close fullscreen" : "Fullscreen diagram"}
          aria-label={isFullscreen ? "Close fullscreen" : "Fullscreen diagram"}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex items-center justify-center p-8"
        onClick={(e) => {
          // Close on backdrop click
          if (e.target === e.currentTarget) {
            setIsFullscreen(false);
          }
        }}
      >
        <div className="w-full max-w-6xl max-h-[90vh] overflow-auto">
          <DiagramContent />
        </div>
      </div>
    );
  }

  return <DiagramContent />;
}