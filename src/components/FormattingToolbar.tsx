import { useState, useEffect, useRef, useCallback } from "react";
import { Bold, Italic, Underline, Code } from "lucide-react";

interface FormattingToolbarProps {
  targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
}

const FORMATS = [
  { icon: Bold, wrap: ["**", "**"], label: "Bold" },
  { icon: Italic, wrap: ["*", "*"], label: "Italic" },
  { icon: Underline, wrap: ["__", "__"], label: "Underline" },
  { icon: Code, wrap: ["`", "`"], label: "Code" },
] as const;

const FormattingToolbar = ({ targetRef, value, onChange }: FormattingToolbarProps) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [hasSelection, setHasSelection] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const checkSelection = useCallback(() => {
    const el = targetRef.current;
    if (!el || document.activeElement !== el) {
      setVisible(false);
      return;
    }

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    if (start === end) {
      setVisible(false);
      setHasSelection(false);
      return;
    }

    setHasSelection(true);
    setVisible(true);

    // Position above the input
    const rect = el.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    setPosition({
      top: rect.top + scrollY - 44,
      left: rect.left + scrollX + (rect.width / 2),
    });
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const handler = () => requestAnimationFrame(checkSelection);

    el.addEventListener("select", handler);
    el.addEventListener("mouseup", handler);
    el.addEventListener("keyup", handler);
    el.addEventListener("blur", () => {
      // Delay to allow toolbar button click
      setTimeout(() => {
        if (!toolbarRef.current?.contains(document.activeElement)) {
          setVisible(false);
        }
      }, 150);
    });

    return () => {
      el.removeEventListener("select", handler);
      el.removeEventListener("mouseup", handler);
      el.removeEventListener("keyup", handler);
    };
  }, [targetRef, checkSelection]);

  const applyFormat = (prefix: string, suffix: string) => {
    const el = targetRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = value.slice(start, end);

    // Check if already wrapped — unwrap if so
    const beforePrefix = value.slice(Math.max(0, start - prefix.length), start);
    const afterSuffix = value.slice(end, end + suffix.length);

    let newValue: string;
    let newStart: number;
    let newEnd: number;

    if (beforePrefix === prefix && afterSuffix === suffix) {
      // Unwrap
      newValue = value.slice(0, start - prefix.length) + selected + value.slice(end + suffix.length);
      newStart = start - prefix.length;
      newEnd = end - prefix.length;
    } else {
      // Wrap
      newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
      newStart = start + prefix.length;
      newEnd = end + prefix.length;
    }

    onChange(newValue);

    // Restore selection
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newStart, newEnd);
    });
  };

  if (!visible || !hasSelection) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[100] flex items-center gap-0.5 rounded-lg border bg-popover px-1 py-1 shadow-lg animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {FORMATS.map(({ icon: Icon, wrap, label }) => (
        <button
          key={label}
          type="button"
          onClick={() => applyFormat(wrap[0], wrap[1])}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
};

export default FormattingToolbar;
