## Packages
react-markdown | For rendering markdown messages from the AI
remark-gfm | For tables and GitHub flavored markdown support
react-syntax-highlighter | For code block syntax highlighting
@types/react-syntax-highlighter | Types for syntax highlighter
mermaid | For rendering architecture diagrams dynamically

## Notes
- Tailwind configuration: please add JetBrains Mono for monospace fonts if possible, else standard mono works.
- Using SSE streaming to read chunks from `/api/conversations/:id/messages`.
