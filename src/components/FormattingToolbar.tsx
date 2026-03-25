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
  const toolbarRef = useRef<HTMLDivElement>(null);

  const checkSelection = useCallback(() => {
    const el = targetRef.current;
    if (!el || document.activeElement !== el) {
      setVisible(false);
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    setVisible(start !== end);
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const handler = () => requestAnimationFrame(checkSelection);
    const blurHandler = () => {
      setTimeout(() => {
        if (!toolbarRef.current?.contains(document.activeElement)) {
          setVisible(false);
        }
      }, 150);
    };

    el.addEventListener("select", handler);
    el.addEventListener("mouseup", handler);
    el.addEventListener("keyup", handler);
    el.addEventListener("blur", blurHandler);

    return () => {
      el.removeEventListener("select", handler);
      el.removeEventListener("mouseup", handler);
      el.removeEventListener("keyup", handler);
      el.removeEventListener("blur", blurHandler);
    };
  }, [targetRef, checkSelection]);

  const applyFormat = (prefix: string, suffix: string) => {
    const el = targetRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = value.slice(start, end);

    const beforePrefix = value.slice(Math.max(0, start - prefix.length), start);
    const afterSuffix = value.slice(end, end + suffix.length);

    let newValue: string;
    let newStart: number;
    let newEnd: number;

    if (beforePrefix === prefix && afterSuffix === suffix) {
      newValue = value.slice(0, start - prefix.length) + selected + value.slice(end + suffix.length);
      newStart = start - prefix.length;
      newEnd = end - prefix.length;
    } else {
      newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
      newStart = start + prefix.length;
      newEnd = end + prefix.length;
    }

    onChange(newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newStart, newEnd);
    });
  };

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="flex items-center gap-0.5 rounded-lg border bg-popover px-1 py-1 shadow-sm mt-1"
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
