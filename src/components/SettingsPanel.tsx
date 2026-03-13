import { useState, useEffect, useCallback } from "react";
import { Settings, X, Volume2, VolumeX, Clock, Zap, Tag, Trash2, Pencil, Check } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface TagType {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

const TAG_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#64748b",
];

const SettingsPanel = () => {
  const { settings, updateSettings } = useSettings();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-sm border-l bg-card shadow-xl animate-in slide-in-from-right duration-200">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-base font-semibold">Settings</h2>
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
            {/* Timer Durations */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-primary" />
                Timer Durations
              </div>

              <DurationSlider
                label="Focus"
                value={settings.focusDuration}
                min={1}
                max={90}
                unit="min"
                onChange={(v) => updateSettings({ focusDuration: v })}
              />
              <DurationSlider
                label="Short Break"
                value={settings.shortBreakDuration}
                min={1}
                max={30}
                unit="min"
                onChange={(v) => updateSettings({ shortBreakDuration: v })}
              />
              <DurationSlider
                label="Long Break"
                value={settings.longBreakDuration}
                min={1}
                max={60}
                unit="min"
                onChange={(v) => updateSettings({ longBreakDuration: v })}
              />
              <DurationSlider
                label="Long Break Every"
                value={settings.longBreakInterval}
                min={2}
                max={8}
                unit="sessions"
                onChange={(v) => updateSettings({ longBreakInterval: v })}
              />
            </section>

            {/* Auto-Start */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-primary" />
                Automation
              </div>

              <ToggleRow
                label="Auto-start Breaks"
                description="Automatically start break timer after focus ends"
                checked={settings.autoStartBreaks}
                onChange={(v) => updateSettings({ autoStartBreaks: v })}
              />
              <ToggleRow
                label="Auto-start Focus"
                description="Automatically start focus timer after break ends"
                checked={settings.autoStartFocus}
                onChange={(v) => updateSettings({ autoStartFocus: v })}
              />
            </section>

            {/* Sound */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                {settings.soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-primary" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
                Sound
              </div>

              <ToggleRow
                label="Notification Sound"
                description="Play a sound when a timer session ends"
                checked={settings.soundEnabled}
                onChange={(v) => updateSettings({ soundEnabled: v })}
              />

              {settings.soundEnabled && (
                <DurationSlider
                  label="Volume"
                  value={settings.soundVolume}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => updateSettings({ soundVolume: v })}
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

const DurationSlider = ({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium tabular-nums">
        {value} {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 rounded-full appearance-none bg-accent cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
        [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-pointer"
    />
  </div>
);

const ToggleRow = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <p className="text-sm">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-accent"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  </div>
);

export default SettingsPanel;
