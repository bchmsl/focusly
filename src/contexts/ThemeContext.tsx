import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type ThemeId = "coral" | "ocean" | "forest" | "lavender" | "ember" | "slate";
export type ColorMode = "light" | "dark" | "system";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  accent: string; // preview swatch color
}

export const THEMES: ThemeOption[] = [
  { id: "coral", name: "Coral", accent: "#f43f5e" },
  { id: "ocean", name: "Ocean", accent: "#0ea5e9" },
  { id: "forest", name: "Forest", accent: "#22c55e" },
  { id: "lavender", name: "Lavender", accent: "#a78bfa" },
  { id: "ember", name: "Ember", accent: "#f97316" },
  { id: "slate", name: "Slate", accent: "#64748b" },
];

interface ThemeContextType {
  themeId: ThemeId;
  colorMode: ColorMode;
  isDark: boolean;
  setThemeId: (id: ThemeId) => void;
  setColorMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeId: "coral",
  colorMode: "system",
  isDark: false,
  setThemeId: () => {},
  setColorMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "coral";
    return (localStorage.getItem("themeId") as ThemeId) || "coral";
  });

  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("colorMode") as ColorMode) || "system";
  });

  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const isDark = colorMode === "dark" || (colorMode === "system" && systemDark);

  const setThemeId = (id: ThemeId) => {
    setThemeIdState(id);
    localStorage.setItem("themeId", id);
  };

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode);
    localStorage.setItem("colorMode", mode);
  };

  useEffect(() => {
    const root = document.documentElement;
    // Set data attribute for theme
    root.setAttribute("data-theme", themeId);
    // Toggle dark class
    root.classList.toggle("dark", isDark);
  }, [themeId, isDark]);

  return (
    <ThemeContext.Provider value={{ themeId, colorMode, isDark, setThemeId, setColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
