import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";

interface PomodoroTimerProps {
  onTimerEnd?: (mode: string) => void;
  reloadRef?: React.MutableRefObject<(() => void) | null>;
  expanded?: boolean;
}

type TimerMode = "focus" | "shortBreak" | "longBreak";

const MODE_LABELS: Record<TimerMode, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const PomodoroTimer = ({ onTimerEnd, reloadRef, expanded }: PomodoroTimerProps) => {
  const { user } = useAuth();
  const { settings, loaded: settingsLoaded } = useSettings();

  const getDurations = useCallback((): Record<TimerMode, number> => ({
    focus: settings.focusDuration * 60,
    shortBreak: settings.shortBreakDuration * 60,
    longBreak: settings.longBreakDuration * 60,
  }), [settings.focusDuration, settings.shortBreakDuration, settings.longBreakDuration]);

  const [mode, setMode] = useState<TimerMode>("focus");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Guard: skip saves until initial load is fully applied
  const initialLoadDoneRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  // Guard to ignore realtime echoes of our own saves
  const ignoringRealtimeUntilRef = useRef<number>(0);

  // Use refs to avoid stale closures in the timer interval
  const modeRef = useRef(mode);
  const completedSessionsRef = useRef(completedSessions);
  const settingsRef = useRef(settings);
  const isRunningRef = useRef(isRunning);
  const timeLeftRef = useRef(timeLeft);
  const loadedTimerStateForUserRef = useRef<string | null>(null);

  modeRef.current = mode;
  completedSessionsRef.current = completedSessions;
  settingsRef.current = settings;
  isRunningRef.current = isRunning;
  timeLeftRef.current = timeLeft;

  const durations = getDurations();
  const totalTime = durations[mode];
  const displayTimeLeft = timeLeft ?? durations.focus;
  const progress = Math.max(0, Math.min(100, ((totalTime - displayTimeLeft) / totalTime) * 100));

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const playSound = useCallback(() => {
    if (!settings.soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const vol = ctx.createGain();
      vol.gain.value = settings.soundVolume / 100;
      vol.connect(ctx.destination);
      [440, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(vol);
        osc.start(ctx.currentTime + i * 0.25);
        osc.stop(ctx.currentTime + i * 0.25 + 0.2);
      });
    } catch {
      // AudioContext may not be available
    }
  }, [settings.soundEnabled, settings.soundVolume]);

  // Save timer state (debounced) – also sets a guard window for realtime echoes
  const saveState = useCallback(
    (m: TimerMode, tl: number, running: boolean, sessions: number) => {
      if (!user) return;
      // Don't save during initial load — prevents overwriting remote state
      if (!initialLoadDoneRef.current) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      // Ignore realtime echoes for 2 seconds after our own save
      ignoringRealtimeUntilRef.current = Date.now() + 2000;
      saveTimeoutRef.current = window.setTimeout(async () => {
        await supabase
          .from("timer_state")
          .upsert({
            user_id: user.id,
            mode: m,
            time_left: tl,
            is_running: running,
            completed_sessions: sessions,
            last_tick_at: running ? new Date().toISOString() : null,
          }, { onConflict: "user_id" });
      }, 300);
    },
    [user]
  );

  const loadTimerState = useCallback(async () => {
    if (!user || !settingsLoaded) return;

    const { data } = await supabase
      .from("timer_state")
      .select("mode, time_left, is_running, completed_sessions, last_tick_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const d: Record<TimerMode, number> = {
      focus: settings.focusDuration * 60,
      shortBreak: settings.shortBreakDuration * 60,
      longBreak: settings.longBreakDuration * 60,
    };

    if (data) {
      const m = data.mode as TimerMode;
      let tl = data.time_left;
      if (data.is_running && data.last_tick_at) {
        const elapsed = Math.floor((Date.now() - new Date(data.last_tick_at).getTime()) / 1000);
        tl = Math.max(0, tl - elapsed);
      }
      setMode(m);
      setTimeLeft(tl);
      setIsRunning(data.is_running && tl > 0);
      setCompletedSessions(data.completed_sessions);
    } else {
      setTimeLeft(d.focus);
    }

    setLoaded(true);
    // Allow saves only after React has processed the loaded state
    // to prevent the settings-change effect from overwriting remote state
    requestAnimationFrame(() => {
      initialLoadDoneRef.current = true;
    });
  }, [user, settingsLoaded, settings.focusDuration, settings.shortBreakDuration, settings.longBreakDuration]);

  // Load timer state from DB (once per user)
  useEffect(() => {
    if (!user || !settingsLoaded) return;
    if (loadedTimerStateForUserRef.current === user.id) return;
    loadedTimerStateForUserRef.current = user.id;
    loadTimerState();
  }, [user, settingsLoaded, loadTimerState]);

  // Expose reload function to parent
  useEffect(() => {
    if (reloadRef) reloadRef.current = loadTimerState;
  }, [reloadRef, loadTimerState]);

  // Realtime subscription – sync timer across devices
  useEffect(() => {
    if (!user || !loaded) return;

    const channel = supabase
      .channel(`timer_state_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'timer_state',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Skip echoes from our own saves
          if (Date.now() < ignoringRealtimeUntilRef.current) return;

          const data = payload.new as {
            mode: string;
            time_left: number;
            is_running: boolean;
            completed_sessions: number;
            last_tick_at: string | null;
          };

          const m = data.mode as TimerMode;
          let tl = data.time_left;

          // Account for time elapsed since the remote save
          if (data.is_running && data.last_tick_at) {
            const elapsed = Math.floor((Date.now() - new Date(data.last_tick_at).getTime()) / 1000);
            tl = Math.max(0, tl - elapsed);
          }

          const shouldRun = data.is_running && tl > 0;
          const localRunning = isRunningRef.current;
          const localTimeLeft = timeLeftRef.current ?? 0;
          const localMode = modeRef.current;

          // If both devices are running the same mode, only apply
          // the remote update when the time difference is significant
          // (> 3s). This prevents the "jumping" caused by periodic
          // saves from the other device.
          if (localRunning && shouldRun && m === localMode) {
            const drift = Math.abs(localTimeLeft - tl);
            if (drift <= 3) return; // close enough, ignore
          }

          setMode(m);
          setTimeLeft(tl);
          setIsRunning(shouldRun);
          setCompletedSessions(data.completed_sessions);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loaded, clearTimer]);

  const switchMode = useCallback(
    (newMode: TimerMode, sessions?: number, autoStart?: boolean) => {
      clearTimer();
      const s = sessions ?? completedSessionsRef.current;
      const d = getDurations();
      setMode(newMode);
      setTimeLeft(d[newMode]);
      const shouldAutoStart = autoStart ?? false;
      setIsRunning(shouldAutoStart);
      saveState(newMode, d[newMode], shouldAutoStart, s);
    },
    [clearTimer, saveState, getDurations]
  );

  // Called when timer reaches zero or user clicks skip
  const handleTimerComplete = useCallback(() => {
    playSound();
    const currentMode = modeRef.current;
    const sessions = completedSessionsRef.current;
    const s = settingsRef.current;

    onTimerEnd?.(currentMode === "focus" ? "Focus session" : currentMode === "shortBreak" ? "Short break" : "Long break");

    if (currentMode === "focus") {
      const next = sessions + 1;
      setCompletedSessions(next);
      if (next >= s.longBreakInterval) {
        setCompletedSessions(0);
        switchMode("longBreak", 0, s.autoStartBreaks);
      } else {
        switchMode("shortBreak", next, s.autoStartBreaks);
      }
    } else {
      switchMode("focus", undefined, s.autoStartFocus);
    }
  }, [switchMode, playSound, onTimerEnd]);

  // Timer tick effect
  useEffect(() => {
    if (!loaded) return;
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          const current = prev ?? 0;
          if (current <= 1) {
            clearTimer();
            setIsRunning(false);
            setTimeout(() => handleTimerComplete(), 50);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [isRunning, clearTimer, handleTimerComplete, loaded]);

  // Persist time_left periodically while running (every 10 seconds)
  useEffect(() => {
    if (!loaded || !isRunning) return;
    const persist = window.setInterval(() => {
      const tl = timeLeftRef.current;
      if (tl != null && tl > 0) {
        saveState(modeRef.current, tl, true, completedSessionsRef.current);
      }
    }, 10000);
    return () => clearInterval(persist);
  }, [loaded, isRunning, saveState]);

  // Update duration when settings change
  const prevFocusDur = useRef(settings.focusDuration);
  const prevShortDur = useRef(settings.shortBreakDuration);
  const prevLongDur = useRef(settings.longBreakDuration);

  useEffect(() => {
    if (!loaded) return;

    const changed =
      prevFocusDur.current !== settings.focusDuration ||
      prevShortDur.current !== settings.shortBreakDuration ||
      prevLongDur.current !== settings.longBreakDuration;

    prevFocusDur.current = settings.focusDuration;
    prevShortDur.current = settings.shortBreakDuration;
    prevLongDur.current = settings.longBreakDuration;

    if (!changed) return;

    clearTimer();
    const newDuration = getDurations()[mode];
    setTimeLeft(newDuration);
    setIsRunning(false);
    saveState(mode, newDuration, false, completedSessions);
  }, [settings.focusDuration, settings.shortBreakDuration, settings.longBreakDuration, loaded, isRunning, mode, getDurations, saveState, completedSessions]);

  const toggleRunning = () => {
    const next = !isRunning;
    setIsRunning(next);
    saveState(mode, displayTimeLeft, next, completedSessions);
  };

  const handleReset = () => {
    clearTimer();
    const d = getDurations();
    setTimeLeft(d[mode]);
    setIsRunning(false);
    saveState(mode, d[mode], false, completedSessions);
  };

  const minutes = Math.floor(displayTimeLeft / 60);
  const seconds = displayTimeLeft % 60;
  const isFocus = mode === "focus";

  // Show loading skeleton until timer state is loaded from DB
  if (timeLeft === null) {
    return (
      <div className="flex flex-col items-center gap-8">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {["Focus", "Short Break", "Long Break"].map((label) => (
            <div key={label} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground">{label}</div>
          ))}
        </div>
        <div className="relative flex items-center justify-center">
          <svg className="h-56 w-56 -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--accent))" strokeWidth="6" />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="font-mono-timer text-5xl font-bold text-muted-foreground/30">--:--</span>
            <span className="mt-1 text-sm font-medium text-muted-foreground">Loading</span>
          </div>
        </div>
        <div className="h-2.5" />
        <div className="h-14" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${expanded ? "gap-12" : "gap-8"}`}>
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["focus", "shortBreak", "longBreak"] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === m
                ? isFocus
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Timer circle */}
      <div className="relative flex items-center justify-center">
        <svg className={`${expanded ? "h-80 w-80 lg:h-[28rem] lg:w-[28rem]" : "h-56 w-56"} -rotate-90 transition-all`} viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--accent))" strokeWidth="6" />
          <circle
            cx="100" cy="100" r="90" fill="none"
            stroke={isFocus ? "hsl(var(--primary))" : "hsl(var(--secondary))"}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 90}
            strokeDashoffset={2 * Math.PI * 90 * (1 - progress / 100)}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`font-mono-timer font-bold ${isRunning ? "timer-pulse" : ""} ${expanded ? "text-7xl lg:text-8xl" : "text-5xl"} transition-all`}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <span className={`mt-1 font-medium text-muted-foreground ${expanded ? "text-lg" : "text-sm"}`}>
            {MODE_LABELS[mode]}
          </span>
        </div>
      </div>

      {/* Session dots */}
      <div className={`flex ${expanded ? "gap-3" : "gap-2"}`}>
        {Array.from({ length: settings.longBreakInterval }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-colors ${
              i < completedSessions ? "bg-primary" : "bg-accent"
            } ${expanded ? "h-3.5 w-3.5" : "h-2.5 w-2.5"}`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className={`flex items-center ${expanded ? "gap-5" : "gap-3"}`}>
        <button onClick={handleReset} className={`flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${expanded ? "h-14 w-14" : "h-10 w-10"}`} aria-label="Reset">
          <RotateCcw className={expanded ? "h-6 w-6" : "h-4 w-4"} />
        </button>
        <button
          onClick={toggleRunning}
          className={`flex items-center justify-center rounded-full text-primary-foreground transition-all hover:scale-105 active:scale-95 ${
            isFocus ? "bg-primary" : "bg-secondary"
          } ${expanded ? "h-20 w-20" : "h-14 w-14"}`}
          aria-label={isRunning ? "Pause" : "Start"}
        >
          {isRunning ? <Pause className={expanded ? "h-9 w-9" : "h-6 w-6"} /> : <Play className={`ml-0.5 ${expanded ? "h-9 w-9" : "h-6 w-6"}`} />}
        </button>
        <button onClick={handleTimerComplete} className={`flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${expanded ? "h-14 w-14" : "h-10 w-10"}`} aria-label="Skip">
          <SkipForward className={expanded ? "h-6 w-6" : "h-4 w-4"} />
        </button>
      </div>
    </div>
  );
};

export default PomodoroTimer;
