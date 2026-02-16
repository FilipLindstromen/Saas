import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/** Convert **[Headline]**, **[Opening]** etc. to markdown headings for proper styling */
function preprocessSectionHeaders(text: string): string {
  return text.replace(/\*\*\[([^\]]+)\]\*\*/g, '\n\n## $1\n\n');
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const processedContent = preprocessSectionHeaders(content);
  return (
    <div className={`markdownContent ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
          h4: ({ children }) => <h4 className="md-h4">{children}</h4>,
          p: ({ children }) => <p className="md-p">{children}</p>,
          strong: ({ children }) => <strong className="md-strong">{children}</strong>,
          em: ({ children }) => <em className="md-em">{children}</em>,
          ul: ({ children }) => <ul className="md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="md-ol">{children}</ol>,
          li: ({ children }) => <li className="md-li">{children}</li>,
          blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
          hr: () => <hr className="md-hr" />,
          code: ({ children }) => <code className="md-code">{children}</code>,
          pre: ({ children }) => <pre className="md-pre">{children}</pre>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
