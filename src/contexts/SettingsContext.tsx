import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CardLayout {
  left: string[];
  right: string[];
  widths: Record<string, "full" | "half">;
  collapsed: string[];
}

const DEFAULT_CARD_LAYOUT: CardLayout = {
  left: ["timer"],
  right: ["tasks", "notes"],
  widths: { timer: "half", tasks: "half", notes: "half" },
  collapsed: [],
};

export interface Settings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  displayMode: "pomodoro" | "clock";
  showSeconds: boolean;
  weatherCity: string | null;
  showPomodoro: boolean;
  showTasks: boolean;
  showNotes: boolean;
  cardLayout: CardLayout;
}

const DEFAULT_SETTINGS: Settings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  soundVolume: 70,
  displayMode: "pomodoro",
  showSeconds: false,
  weatherCity: null,
  showPomodoro: true,
  showTasks: true,
  showNotes: true,
  cardLayout: DEFAULT_CARD_LAYOUT,
};

interface SettingsContextType {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  loaded: boolean;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  loaded: false,
  reload: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

function parseCardLayout(raw: any): CardLayout {
  if (!raw || typeof raw !== "object") return DEFAULT_CARD_LAYOUT;

  // Migration: convert old flat `order` format to two-column
  if (Array.isArray(raw.order) && !raw.left && !raw.right) {
    const order = raw.order.filter((c: string) => c !== "clock") as string[];
    const widths = raw.widths && typeof raw.widths === "object" ? raw.widths : DEFAULT_CARD_LAYOUT.widths;
    const collapsed = Array.isArray(raw.collapsed) ? raw.collapsed : [];
    // Split: first half-width pair goes left/right, rest goes right
    const left: string[] = [];
    const right: string[] = [];
    for (const card of order) {
      if (left.length === 0 || (widths[card] === "half" && left.length <= right.length)) {
        left.push(card);
      } else {
        right.push(card);
      }
    }
    return { left, right, widths, collapsed };
  }

  return {
    left: Array.isArray(raw.left) ? raw.left : DEFAULT_CARD_LAYOUT.left,
    right: Array.isArray(raw.right) ? raw.right : DEFAULT_CARD_LAYOUT.right,
    widths: raw.widths && typeof raw.widths === "object" ? raw.widths : DEFAULT_CARD_LAYOUT.widths,
    collapsed: Array.isArray(raw.collapsed) ? raw.collapsed : [],
  };
}

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const suppressReloadUntilRef = useRef(0);

  const loadFromDb = useCallback(async (force?: boolean) => {
    if (!force && Date.now() < suppressReloadUntilRef.current) return;
    if (!user) { setLoaded(true); return; }
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setSettings({
        focusDuration: data.focus_duration,
        shortBreakDuration: data.short_break_duration,
        longBreakDuration: data.long_break_duration,
        longBreakInterval: data.long_break_interval,
        autoStartBreaks: data.auto_start_breaks,
        autoStartFocus: data.auto_start_focus,
        soundEnabled: data.sound_enabled,
        soundVolume: data.sound_volume,
        displayMode: (data as any).display_mode ?? "pomodoro",
        showSeconds: (data as any).show_seconds ?? false,
        weatherCity: (data as any).weather_city ?? null,
        showPomodoro: (data as any).show_pomodoro ?? true,
        showTasks: (data as any).show_tasks ?? true,
        showNotes: (data as any).show_notes ?? true,
        cardLayout: parseCardLayout((data as any).card_layout),
      });
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => { loadFromDb(); }, [loadFromDb]);

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    suppressReloadUntilRef.current = Date.now() + 2000;
    if (!user) return;

    await supabase.from("user_settings").upsert({
      user_id: user.id,
      focus_duration: next.focusDuration,
      short_break_duration: next.shortBreakDuration,
      long_break_duration: next.longBreakDuration,
      long_break_interval: next.longBreakInterval,
      auto_start_breaks: next.autoStartBreaks,
      auto_start_focus: next.autoStartFocus,
      sound_enabled: next.soundEnabled,
      sound_volume: next.soundVolume,
      display_mode: next.displayMode,
      show_seconds: next.showSeconds,
      weather_city: next.weatherCity,
      show_pomodoro: next.showPomodoro,
      show_tasks: next.showTasks,
      show_notes: next.showNotes,
      card_layout: next.cardLayout,
    } as any, { onConflict: "user_id" });
  }, [settings, user]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loaded, reload: loadFromDb }}>
      {children}
    </SettingsContext.Provider>
  );
};
