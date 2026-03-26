import React, { useRef, useEffect } from "react";
import LinkifiedText from "@/components/LinkifiedText";

interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  autoFocus?: boolean;
}

const RichTextInput = ({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  multiline = false,
  rows = 6,
  className = "",
  inputRef,
  autoFocus,
}: RichTextInputProps) => {
  const internalRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const ref = (inputRef as any) || internalRef;

  // Sync scroll between textarea and overlay
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!multiline) return;
    const el = ref.current;
    const overlay = overlayRef.current;
    if (!el || !overlay) return;

    const syncScroll = () => {
      overlay.scrollTop = el.scrollTop;
    };
    el.addEventListener("scroll", syncScroll);
    return () => el.removeEventListener("scroll", syncScroll);
  }, [multiline, ref]);

  const baseClasses =
    "w-full rounded-lg border bg-card px-3 py-2.5 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow";

  if (multiline) {
    return (
      <div className="relative">
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={rows}
          autoFocus={autoFocus}
          className={`${baseClasses} text-sm resize-y relative z-[1] text-transparent caret-foreground selection:bg-primary/20 ${className}`}
          style={{ WebkitTextFillColor: "transparent" }}
        />
        <div
          ref={overlayRef}
          aria-hidden
          className="absolute inset-0 rounded-lg px-3 py-2.5 text-sm pointer-events-none overflow-hidden whitespace-pre-wrap break-words border border-transparent"
        >
          {value ? (
            <LinkifiedText text={value} />
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={ref as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`${baseClasses} text-base relative z-[1] text-transparent caret-foreground selection:bg-primary/20 ${className}`}
        style={{ WebkitTextFillColor: "transparent" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 rounded-lg px-3 py-2.5 text-base pointer-events-none overflow-hidden whitespace-nowrap text-ellipsis border border-transparent flex items-center"
      >
        {value ? (
          <LinkifiedText text={value} className="truncate" />
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </div>
    </div>
  );
};

export default RichTextInput;
