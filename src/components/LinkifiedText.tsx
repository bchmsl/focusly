import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]},]+)/g;

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

const LinkifiedText = ({ text, className }: LinkifiedTextProps) => {
  const parts = text.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-primary/40 underline-offset-2 text-primary/80 hover:text-primary hover:decoration-primary/70 transition-colors break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
};

export default LinkifiedText;
