import { Moon, Sun, Monitor, Palette } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme, THEMES, type ColorMode } from "@/contexts/ThemeContext";

const COLOR_MODES: { id: ColorMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

const ThemeToggle = () => {
  const { themeId, colorMode, isDark, setThemeId, setColorMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Theme settings"
      >
        <Palette className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border bg-card p-3 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Color themes */}
          <p className="text-[11px] font-medium text-muted-foreground mb-2 px-1">Theme</p>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id)}
                className={`flex flex-col items-center gap-1.5 rounded-lg px-2 py-2 text-[11px] transition-colors ${
                  themeId === t.id
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full ring-2 ring-offset-2 ring-offset-card transition-shadow ${
                    themeId === t.id ? "ring-foreground/40" : "ring-transparent"
                  }`}
                  style={{ backgroundColor: t.accent }}
                />
                {t.name}
              </button>
            ))}
          </div>

          {/* Color mode */}
          <div className="border-t pt-2">
            <p className="text-[11px] font-medium text-muted-foreground mb-2 px-1">Appearance</p>
            <div className="flex gap-1">
              {COLOR_MODES.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => setColorMode(m.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
                      colorMode === m.id
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
