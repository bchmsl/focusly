import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";

type TimerMode = "focus" | "shortBreak" | "longBreak";

const DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_LABELS: Record<TimerMode, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const TOTAL_FOCUS_SESSIONS = 4;

const PomodoroTimer = () => {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const totalTime = DURATIONS[mode];
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const switchMode = useCallback((newMode: TimerMode) => {
    clearTimer();
    setMode(newMode);
    setTimeLeft(DURATIONS[newMode]);
    setIsRunning(false);
  }, [clearTimer]);

  const handleSkip = useCallback(() => {
    if (mode === "focus") {
      const next = completedSessions + 1;
      setCompletedSessions(next);
      if (next >= TOTAL_FOCUS_SESSIONS) {
        switchMode("longBreak");
        setCompletedSessions(0);
      } else {
        switchMode("shortBreak");
      }
    } else {
      switchMode("focus");
    }
  }, [mode, completedSessions, switchMode]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearTimer();
            setIsRunning(false);
            // Auto-advance after a tick
            setTimeout(() => handleSkip(), 300);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [isRunning, clearTimer, handleSkip]);

  const handleReset = () => {
    clearTimer();
    setTimeLeft(DURATIONS[mode]);
    setIsRunning(false);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isFocus = mode === "focus";

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(Object.keys(DURATIONS) as TimerMode[]).map((m) => (
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
        <svg className="h-56 w-56 -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="6"
          />
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke={isFocus ? "hsl(var(--primary))" : "hsl(var(--secondary))"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 90}
            strokeDashoffset={2 * Math.PI * 90 * (1 - progress / 100)}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`font-mono-timer text-5xl font-bold ${isRunning ? "timer-pulse" : ""}`}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <span className="mt-1 text-sm font-medium text-muted-foreground">
            {MODE_LABELS[mode]}
          </span>
        </div>
      </div>

      {/* Session dots */}
      <div className="flex gap-2">
        {Array.from({ length: TOTAL_FOCUS_SESSIONS }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              i < completedSessions
                ? "bg-primary"
                : "bg-accent"
            }`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleReset}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground transition-all hover:scale-105 active:scale-95 ${
            isFocus ? "bg-primary" : "bg-secondary"
          }`}
          aria-label={isRunning ? "Pause" : "Start"}
        >
          {isRunning ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
        </button>
        <button
          onClick={handleSkip}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Skip"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PomodoroTimer;
