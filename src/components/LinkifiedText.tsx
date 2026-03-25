import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]},]+)/;
const BOLD_REGEX = /\*\*(.+?)\*\*/;
const ITALIC_REGEX = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/;
const UNDERLINE_REGEX = /__(.+?)__/;
const CODE_REGEX = /`([^`]+)`/;

// Combined regex that matches any token
const COMBINED_REGEX = /(https?:\/\/[^\s<>"')\]},]+|\*\*(.+?)\*\*|(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|__(.+?)__|`([^`]+)`)/g;

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

const parseFormattedText = (text: string): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // Reset lastIndex for global regex
  COMBINED_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = COMBINED_REGEX.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      result.push(<React.Fragment key={key++}>{text.slice(lastIndex, match.index)}</React.Fragment>);
    }

    const full = match[0];

    if (URL_REGEX.test(full) && full.startsWith("http")) {
      result.push(
        <a
          key={key++}
          href={full}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-primary/40 underline-offset-2 text-primary/80 hover:text-primary hover:decoration-primary/70 transition-colors break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {full}
        </a>
      );
    } else if (match[2] !== undefined) {
      // Bold **text**
      result.push(
        <strong key={key++} className="font-bold">{parseFormattedText(match[2])}</strong>
      );
    } else if (match[4] !== undefined) {
      // Underline __text__
      result.push(
        <span key={key++} className="underline underline-offset-2 decoration-foreground/50">{parseFormattedText(match[4])}</span>
      );
    } else if (match[3] !== undefined) {
      // Italic *text*
      result.push(
        <em key={key++} className="italic">{parseFormattedText(match[3])}</em>
      );
    } else if (match[5] !== undefined) {
      // Code `text`
      result.push(
        <code
          key={key++}
          className="rounded-[4px] bg-muted px-1.5 py-0.5 text-[0.85em] font-mono text-accent-foreground"
        >
          {match[5]}
        </code>
      );
    }

    lastIndex = match.index + full.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(<React.Fragment key={key++}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return result;
};

const LinkifiedText = ({ text, className }: LinkifiedTextProps) => {
  return <span className={className}>{parseFormattedText(text)}</span>;
};

export default LinkifiedText;
