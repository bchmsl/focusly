import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Settings {
  focusDuration: number;      // minutes
  shortBreakDuration: number; // minutes
  longBreakDuration: number;  // minutes
  longBreakInterval: number;  // every N focus sessions
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  soundVolume: number;        // 0-100
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

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const loadFromDb = useCallback(async () => {
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
      });
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => { loadFromDb(); }, [loadFromDb]);

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
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
    } as any, { onConflict: "user_id" });
  }, [settings, user]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loaded, reload: loadFromDb }}>
      {children}
    </SettingsContext.Provider>
  );
};
