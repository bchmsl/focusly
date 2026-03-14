import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemeId = "coral" | "ocean" | "forest" | "lavender" | "ember" | "slate";
export type ColorMode = "light" | "dark" | "system";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  accent: string;
}

export const THEMES: ThemeOption[] = [
  { id: "coral", name: "Coral", accent: "#f43f5e" },
  { id: "ocean", name: "Ocean", accent: "#0ea5e9" },
  { id: "forest", name: "Forest", accent: "#22c55e" },
  { id: "lavender", name: "Lavender", accent: "#a78bfa" },
  { id: "ember", name: "Ember", accent: "#f97316" },
  { id: "slate", name: "Slate", accent: "#64748b" },
];

const VALID_THEMES: ThemeId[] = ["coral", "ocean", "forest", "lavender", "ember", "slate"];
const VALID_MODES: ColorMode[] = ["light", "dark", "system"];

interface ThemeContextType {
  themeId: ThemeId;
  colorMode: ColorMode;
  isDark: boolean;
  setThemeId: (id: ThemeId) => void;
  setColorMode: (mode: ColorMode) => void;
  reload: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  themeId: "coral",
  colorMode: "system",
  isDark: false,
  setThemeId: () => {},
  setColorMode: () => {},
  reload: async () => {},
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

  const [userId, setUserId] = useState<string | null>(null);
  const dbLoaded = useRef(false);

  // Listen to auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load theme from DB when user logs in
  useEffect(() => {
    if (!userId) { dbLoaded.current = false; return; }
    const load = async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("theme_id, color_mode")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        const dbTheme = VALID_THEMES.includes(data.theme_id as ThemeId) ? (data.theme_id as ThemeId) : "coral";
        const dbMode = VALID_MODES.includes(data.color_mode as ColorMode) ? (data.color_mode as ColorMode) : "system";
        setThemeIdState(dbTheme);
        setColorModeState(dbMode);
        localStorage.setItem("themeId", dbTheme);
        localStorage.setItem("colorMode", dbMode);
      }
      dbLoaded.current = true;
    };
    load();
  }, [userId]);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const isDark = colorMode === "dark" || (colorMode === "system" && systemDark);

  const saveToDb = useCallback(async (theme: ThemeId, mode: ColorMode) => {
    if (!userId) return;
    await supabase.from("user_settings").upsert({
      user_id: userId,
      theme_id: theme,
      color_mode: mode,
    } as any, { onConflict: "user_id" });
  }, [userId]);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    localStorage.setItem("themeId", id);
    saveToDb(id, colorMode);
  }, [colorMode, saveToDb]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    localStorage.setItem("colorMode", mode);
    saveToDb(themeId, mode);
  }, [themeId, saveToDb]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", themeId);
    root.classList.toggle("dark", isDark);
  }, [themeId, isDark]);

  return (
    <ThemeContext.Provider value={{ themeId, colorMode, isDark, setThemeId, setColorMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
