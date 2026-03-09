import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Maximize2, Minimize2 } from "lucide-react";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "Inter, sans-serif",
});

/**
 * Comprehensive Mermaid syntax sanitizer
 * Fixes common AI-generated syntax errors
 */
function sanitizeMermaid(code: string): string {
  if (!code) return "";

  // Step 1: Initial cleanup
  let cleaned = code
    .replace(/```mermaid/gi, "")
    .replace(/```/g, "")
    .trim();

  // Remove double backticks (breaks sequence diagrams)
  cleaned = cleaned.replace(/``+/g, "");

  // Replace unicode characters
  cleaned = cleaned
    .replace(/[—–]/g, "-")
    .replace(/[→➝➞➜➤▶]/g, ">");

  // Step 2: Line-by-line processing
  let lines = cleaned.split('\n').map(l => l.trim());

  // Step 3: Critical fixes
  lines = lines.map(line => {
    let fixed = line;

    // FIX 1: Remove lines that are only dashes (decorative elements)
    if (/^-{2,}$/.test(fixed)) return "";

    // FIX 2: Remove trailing decorative dashes
    // "Cache Server: Request ----------------" -> "Cache Server: Request"
    fixed = fixed.replace(/\s+-{3,}\s*$/, "");

    // FIX 3: Critical - Fix -->|Label|> to -->|Label|
    // This is the MAIN issue from your logs
    fixed = fixed.replace(
      /(--+>|==+>|-\.+>)\s*\|([^|\n]+?)\|?\s*>/g,
      (_, arrow, label) => `${arrow}|${label.trim()}|`
    );

    // FIX 4: Fix -->Text> to -->|Text|
    fixed = fixed.replace(
      /(--+>|==+>)\s*([A-Za-z][A-Za-z0-9\s]+?)>/g,
      (_, arrow, text) => `${arrow}|${text.trim()}|`
    );

    // FIX 5: Remove standalone trailing arrows with no destination
    // "A -->" becomes ""
    if (/^[A-Z]\s*(--+>|==+>|-\.+>)\s*$/.test(fixed)) return "";

    // FIX 6: Fix broken node definitions
    // This handles "A[Label becomes A[Label]"
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      fixed += "]".repeat(openBrackets - closeBrackets);
    }

    const openParens = (fixed.match(/\(/g) || []).length;
    const closeParens = (fixed.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      fixed += ")".repeat(openParens - closeParens);
    }

    // FIX 7: Remove standalone numbers (common AI mistake)
    // Lines that are ONLY digits
    if (/^\d+$/.test(fixed)) return "";

    // FIX 8: Remove trailing numbers from lines
    // "Service] 1" -> "Service]"
    fixed = fixed.replace(/\]\s*\d+\s*$/, "]");
    fixed = fixed.replace(/\)\s*\d+\s*$/, ")");

    // FIX 9: Fix sequence diagram syntax
    // "Server->>Client" should have a message
    if (/(->|-->>|->>)/.test(fixed) && !fixed.includes(':') && !fixed.includes('|')) {
      const match = fixed.match(/^(\w+)\s*(->|-->>|->>)\s*(\w+)\s*$/);
      if (match) {
        fixed = `${match[1]}${match[2]}${match[3]}: `;
      }
    }

    // FIX 10: Clean up multiple spaces
    fixed = fixed.replace(/\s{2,}/g, " ");

    return fixed.trim();
  });

  // Step 4: Remove empty lines and invalid patterns
  lines = lines.filter(line => {
    if (!line) return false;
    // Remove lines that are only arrows or colons
    if (/^(--+>|==+>|->+|:|;)$/.test(line)) return false;
    // Remove lines with excessive special characters
    if (line.length > 0 && (line.match(/[^\w\s]/g) || []).length / line.length > 0.9) return false;
    return true;
  });

  // Step 5: Ensure diagram type header exists
  const diagramTypes = [
    "graph", "flowchart", "sequenceDiagram", "classDiagram",
    "stateDiagram", "erDiagram", "gantt", "pie", "gitGraph",
    "mindmap", "journey", "requirement"
  ];

  const firstLine = lines[0]?.toLowerCase() || "";
  const hasValidHeader = diagramTypes.some(type =>
    firstLine.startsWith(type.toLowerCase())
  );

  if (!hasValidHeader && lines.length > 0) {
    // Auto-detect diagram type based on content
    const content = lines.join('\n').toLowerCase();

    if (content.includes('participant') || content.includes('->>')) {
      lines.unshift("sequenceDiagram");
    } else if (content.includes('class ')) {
      lines.unshift("classDiagram");
    } else {
      lines.unshift("flowchart TD");
    }
  }

  // Step 6: Final validation
  const result = lines.join('\n');

  // Ensure we have at least 2 lines (header + content)
  if (result.split('\n').length < 2) {
    return "flowchart TD\n    A[No valid content]";
  }

  return result;
}

export function MermaidDiagram({ chart }: { chart: string }) {
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

        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Mermaid rendering failed:", errorMessage);
        console.error("Original code:", chart);
        console.error("Sanitized code:", sanitizeMermaid(chart));

        setError(errorMessage);

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

  const DiagramContent = () => (
    <div className="relative group mermaid-wrapper flex justify-center py-6 px-4 bg-zinc-900 rounded-xl border border-zinc-800 overflow-x-auto">
      <div
        ref={containerRef}
        className="min-w-full flex justify-center items-center"
      />
      {!error && (
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute top-3 right-3 p-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          title={isFullscreen ? "Close fullscreen" : "Fullscreen diagram"}
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
      <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex items-center justify-center p-8">
        <div className="w-full max-w-6xl max-h-[90vh] overflow-auto">
          <DiagramContent />
        </div>
      </div>
    );
  }

  return <DiagramContent />;
}