/**
 * Mermaid diagram sanitizer
 * Fixes common AI-generated syntax errors in Mermaid diagrams
 */

/**
 * Remove decorative elements that break Mermaid parsing
 */
function removeDecorativeElements(line: string): string {
    // Remove lines that are only dashes (decorative separators)
    if (/^-{2,}$/.test(line)) return "";

    // Remove trailing decorative dashes
    // "Cache Server: Request ----------------" -> "Cache Server: Request"
    return line.replace(/\s+-{3,}\s*$/, "");
}

/**
 * Fix common arrow syntax errors
 */
function fixArrowSyntax(line: string): string {
    // CRITICAL FIX: Fix -->|Label|> to -->|Label|
    // This is the main issue that causes rendering failures
    line = line.replace(
        /(--+>|==+>|-\.+>)\s*\|([^|\n]+?)\|?\s*>/g,
        (_, arrow, label) => `${arrow}|${label.trim()}|`
    );

    // Fix -->Text> to -->|Text|
    line = line.replace(
        /(--+>|==+>)\s*([A-Za-z][A-Za-z0-9\s]+?)>/g,
        (_, arrow, text) => `${arrow}|${text.trim()}|`
    );

    // Remove standalone trailing arrows with no destination
    // "A -->" becomes ""
    if (/^[A-Z]\s*(--+>|==+>|-\.+>)\s*$/.test(line)) return "";

    return line;
}

/**
 * Fix unclosed brackets and parentheses in node definitions
 */
function fixUnclosedBrackets(line: string): string {
    // Fix unclosed square brackets
    const openBrackets = (line.match(/\[/g) || []).length;
    const closeBrackets = (line.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
        line += "]".repeat(openBrackets - closeBrackets);
    }

    // Fix unclosed parentheses
    const openParens = (line.match(/\(/g) || []).length;
    const closeParens = (line.match(/\)/g) || []).length;
    if (openParens > closeParens) {
        line += ")".repeat(openParens - closeParens);
    }

    return line;
}

/**
 * Remove standalone numbers and trailing numbers
 */
function removeStandaloneNumbers(line: string): string {
    // Remove lines that are only digits (common AI mistake)
    if (/^\d+$/.test(line)) return "";

    // Remove trailing numbers from node definitions
    // "Service] 1" -> "Service]"
    line = line.replace(/\]\s*\d+\s*$/, "]");
    line = line.replace(/\)\s*\d+\s*$/, ")");

    return line;
}

/**
 * Fix sequence diagram syntax issues
 */
function fixSequenceDiagramSyntax(line: string): string {
    // "Server->>Client" should have a message
    if (/(->|-->>|->>)/.test(line) && !line.includes(':') && !line.includes('|')) {
        const match = line.match(/^(\w+)\s*(->|-->>|->>)\s*(\w+)\s*$/);
        if (match) {
            return `${match[1]}${match[2]}${match[3]}: `;
        }
    }
    return line;
}

/**
 * Filter out invalid lines
 */
function isValidLine(line: string): boolean {
    if (!line) return false;

    // Remove lines that are only arrows or colons
    if (/^(--+>|==+>|->+|:|;)$/.test(line)) return false;

    // Remove lines with excessive special characters (likely corrupted)
    if (line.length > 0 && (line.match(/[^\w\s]/g) || []).length / line.length > 0.9) {
        return false;
    }

    return true;
}

/**
 * Auto-detect and add diagram type header if missing
 */
function ensureDiagramHeader(lines: string[]): string[] {
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
        // Auto-detect based on content
        const content = lines.join('\n').toLowerCase();

        if (content.includes('participant') || content.includes('->>')) {
            lines.unshift("sequenceDiagram");
        } else if (content.includes('class ')) {
            lines.unshift("classDiagram");
        } else if (content.includes('state ')) {
            lines.unshift("stateDiagram");
        } else {
            // Default to flowchart
            lines.unshift("flowchart TD");
        }
    }

    return lines;
}

/**
 * Main sanitization function
 * Cleans and validates Mermaid diagram code
 */
export function sanitizeMermaid(code: string): string {
    if (!code) return "";

    // Step 1: Initial cleanup
    let cleaned = code
        .replace(/```mermaid/gi, "")
        .replace(/```/g, "")
        .trim();

    // Remove double backticks (breaks sequence diagrams)
    cleaned = cleaned.replace(/``+/g, "");

    // Replace unicode characters with ASCII equivalents
    cleaned = cleaned
        .replace(/[—–]/g, "-")  // Em dash, en dash -> hyphen
        .replace(/[→➝➞➜➤▶]/g, ">"); // Various arrows -> >

    // Step 2: Process line by line
    let lines = cleaned.split('\n')
        .map(l => l.trim())
        .map(line => {
            // Apply all fixes
            line = removeDecorativeElements(line);
            line = fixArrowSyntax(line);
            line = fixUnclosedBrackets(line);
            line = removeStandaloneNumbers(line);
            line = fixSequenceDiagramSyntax(line);

            // Clean up multiple spaces
            line = line.replace(/\s{2,}/g, " ").trim();

            return line;
        })
        .filter(isValidLine);

    // Step 3: Ensure diagram header
    lines = ensureDiagramHeader(lines);

    // Step 4: Final validation
    const result = lines.join('\n');

    // Ensure we have at least 2 lines (header + content)
    if (result.split('\n').length < 2) {
        return "flowchart TD\n    A[No valid content]";
    }

    return result;
}

/**
 * Validate if a string contains valid Mermaid syntax
 */
export function isValidMermaidSyntax(code: string): boolean {
    try {
        const sanitized = sanitizeMermaid(code);
        return sanitized.split('\n').length >= 2;
    } catch {
        return false;
    }
}