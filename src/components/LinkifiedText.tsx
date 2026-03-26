import React from "react";

const COMBINED_PATTERN = /(https?:\/\/[^\s<>"')\]},]+|\*\*(.+?)\*\*|(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|__(.+?)__|`([^`]+)`)/g;

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

const parseFormattedText = (text: string): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // Create a NEW regex instance each call to avoid shared lastIndex state
  const regex = new RegExp(COMBINED_PATTERN.source, COMBINED_PATTERN.flags);

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(<React.Fragment key={key++}>{text.slice(lastIndex, match.index)}</React.Fragment>);
    }

    const full = match[0];

    if (full.startsWith("http")) {
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
      result.push(
        <strong key={key++} className="font-bold">{parseFormattedText(match[2])}</strong>
      );
    } else if (match[4] !== undefined) {
      result.push(
        <span key={key++} className="underline underline-offset-2 decoration-foreground/50">{parseFormattedText(match[4])}</span>
      );
    } else if (match[3] !== undefined) {
      result.push(
        <em key={key++} className="italic">{parseFormattedText(match[3])}</em>
      );
    } else if (match[5] !== undefined) {
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

  if (lastIndex < text.length) {
    result.push(<React.Fragment key={key++}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return result;
};

const LinkifiedText = ({ text, className }: LinkifiedTextProps) => {
  return <span className={className}>{parseFormattedText(text)}</span>;
};

export default LinkifiedText;
