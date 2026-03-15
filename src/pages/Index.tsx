import { useCallback, useState, useEffect, useRef } from "react";
import PomodoroTimer from "@/components/PomodoroTimer";
import ClockDisplay from "@/components/ClockDisplay";
import TodoList from "@/components/TodoList";
import { Timer, LogOut, Bell, BellOff, Maximize2, Minimize2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import SettingsPanel from "@/components/SettingsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useSettings } from "@/contexts/SettingsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(false);
  const { permission, subscribed, subscribe, sendNotification, isSupported } = usePushNotifications();
  const { settings, reload: reloadSettings } = useSettings();
  const { reload: reloadTheme } = useTheme();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const todoReloadRef = useRef<(() => void) | null>(null);
  const timerReloadRef = useRef<(() => void) | null>(null);
  const [expandedCard, setExpandedCard] = useState<"timer" | "tasks" | null>(null);

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadSettings(), reloadTheme()]);
    todoReloadRef.current?.();
    timerReloadRef.current?.();
  }, [reloadSettings, reloadTheme]);

  // Realtime sync
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        todoReloadRef.current?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_tags' }, () => {
        todoReloadRef.current?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => {
        todoReloadRef.current?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timer_state' }, () => {
        timerReloadRef.current?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          reloadSettings();
          reloadTheme();
        }, 300);
      })
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, reloadSettings, reloadTheme]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleTimerEnd = useCallback((modeName: string) => {
    sendNotification(
      `${modeName} complete!`,
      modeName.includes("Focus")
        ? "Great work! Time for a break."
        : "Break's over — time to focus!"
    );
  }, [sendNotification]);

  const handleEnableNotifications = async () => {
    await subscribe();
  };

  const toggleExpand = (card: "timer" | "tasks") => {
    setExpandedCard((prev) => (prev === card ? null : card));
  };

  const isTimerExpanded = expandedCard === "timer";
  const isTasksExpanded = expandedCard === "tasks";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <button
            onClick={async () => {
              setSpinning(true);
              await reloadAll();
              setSpinning(false);
            }}
            className="p-1 text-primary hover:text-primary/80 transition-colors"
            title="Refresh"
          >
            <Timer className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`} />
          </button>
          <h1 className="text-lg font-semibold">Focusly</h1>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>

            {isSupported && (
              permission !== "granted" || !subscribed ? (
                <button
                  onClick={handleEnableNotifications}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Enable push notifications"
                >
                  <BellOff className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex h-9 items-center px-2.5 text-primary" title="Push notifications enabled">
                  <Bell className="h-4 w-4" />
                </div>
              )
            )}

            <SettingsPanel onTagsChanged={() => todoReloadRef.current?.()} />
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Fullscreen overlay */}
        {expandedCard && (
          <div
            className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm"
            onClick={() => setExpandedCard(null)}
          />
        )}

        <div className={`grid gap-10 lg:grid-cols-2 lg:gap-16 ${expandedCard ? "" : ""}`}>
          {/* Timer / Clock card */}
          {!isTasksExpanded && (
            <div
              className={`flex flex-col items-center transition-all duration-300 ${
                isTimerExpanded
                  ? "fixed inset-4 z-40 flex items-center justify-center"
                  : ""
              }`}
            >
              <div
                className={`w-full rounded-2xl border bg-card shadow-sm relative ${
                  isTimerExpanded
                    ? "h-full flex flex-col items-center justify-center p-12"
                    : "p-8"
                }`}
              >
                <button
                  onClick={() => toggleExpand("timer")}
                  className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors z-10"
                  aria-label={isTimerExpanded ? "Minimize" : "Maximize"}
                >
                  {isTimerExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                {settings.displayMode === "clock" ? (
                  <ClockDisplay />
                ) : (
                  <PomodoroTimer onTimerEnd={handleTimerEnd} reloadRef={timerReloadRef} />
                )}
              </div>
            </div>
          )}

          {/* Tasks card */}
          {!isTimerExpanded && (
            <div
              className={`flex flex-col transition-all duration-300 ${
                isTasksExpanded
                  ? "fixed inset-4 z-40"
                  : ""
              }`}
            >
              <div
                className={`w-full rounded-2xl border bg-card shadow-sm relative ${
                  isTasksExpanded
                    ? "h-full flex flex-col p-6 overflow-hidden"
                    : "p-6"
                }`}
              >
                <button
                  onClick={() => toggleExpand("tasks")}
                  className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors z-10"
                  aria-label={isTasksExpanded ? "Minimize" : "Maximize"}
                >
                  {isTasksExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <h2 className="mb-4 text-base font-semibold">Tasks</h2>
                <div className={isTasksExpanded ? "flex-1 overflow-y-auto" : ""}>
                  <TodoList reloadRef={todoReloadRef} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
