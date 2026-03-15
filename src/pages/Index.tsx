import { useCallback, useState, useEffect, useRef } from "react";
import PomodoroTimer from "@/components/PomodoroTimer";
import ClockDisplay from "@/components/ClockDisplay";
import TodoList from "@/components/TodoList";
import NotesList from "@/components/NotesList";
import { Timer, LogOut, Bell, BellOff, Maximize2, Minimize2, ChevronDown, ChevronUp } from "lucide-react";
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
  const notesReloadRef = useRef<(() => void) | null>(null);
  const [expandedCard, setExpandedCard] = useState<"clock" | "timer" | "tasks" | "notes" | null>(null);
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());

  const toggleCollapse = (card: string) => {
    setCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(card)) next.delete(card);
      else next.add(card);
      return next;
    });
  };

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadSettings(), reloadTheme()]);
    todoReloadRef.current?.();
    timerReloadRef.current?.();
    notesReloadRef.current?.();
  }, [reloadSettings, reloadTheme]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => { todoReloadRef.current?.(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_tags' }, () => { todoReloadRef.current?.(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => { todoReloadRef.current?.(); notesReloadRef.current?.(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => { notesReloadRef.current?.(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_tags' }, () => { notesReloadRef.current?.(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timer_state' }, () => { timerReloadRef.current?.(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { reloadSettings(); reloadTheme(); }, 300);
      })
      .subscribe();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); supabase.removeChannel(channel); };
  }, [user, reloadSettings, reloadTheme]);

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  const handleTimerEnd = useCallback((modeName: string) => {
    sendNotification(
      `${modeName} complete!`,
      modeName.includes("Focus") ? "Great work! Time for a break." : "Break's over — time to focus!"
    );
  }, [sendNotification]);

  const toggleExpand = (card: "clock" | "timer" | "tasks" | "notes") => {
    setExpandedCard((prev) => (prev === card ? null : card));
  };

  const isClockExpanded = expandedCard === "clock";
  const isTimerExpanded = expandedCard === "timer";
  const isTasksExpanded = expandedCard === "tasks";
  const isClockCollapsed = collapsedCards.has("clock");
  const isTimerCollapsed = collapsedCards.has("timer");
  const isTasksCollapsed = collapsedCards.has("tasks");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <button
            onClick={async () => { setSpinning(true); await reloadAll(); setSpinning(false); }}
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
                <button onClick={() => subscribe()} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Enable push notifications">
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
            <button onClick={handleSignOut} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        {/* Fullscreen overlay */}
        {expandedCard && (
          <div className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm" onClick={() => setExpandedCard(null)} />
        )}

        {/* Clock card — always visible, full width */}
        {(!expandedCard || isClockExpanded) && (
          <div className={`transition-all duration-300 ${isClockExpanded ? "fixed inset-4 z-40" : ""}`}>
            <CollapsibleCard
              title="Clock"
              collapsed={!isClockExpanded && isClockCollapsed}
              onToggleCollapse={() => toggleCollapse("clock")}
              expandable
              expanded={isClockExpanded}
              onToggleExpand={() => toggleExpand("clock")}
              className={isClockExpanded ? "h-full flex flex-col items-center justify-center" : ""}
              contentClassName={isClockExpanded ? "flex-1 flex items-center justify-center" : ""}
            >
              <ClockDisplay expanded={isClockExpanded} />
            </CollapsibleCard>
          </div>
        )}

        {/* Timer & Tasks grid */}
        {!isClockExpanded && (
          <div className={`grid gap-6 ${settings.showPomodoro && settings.showTasks ? "lg:grid-cols-2 lg:gap-10" : ""}`}>
            {/* Timer card (pomodoro) — always mounted, hidden via CSS */}
            <div
              className={`flex flex-col items-center transition-all duration-300 ${isTimerExpanded ? "fixed inset-4 z-40" : ""}`}
              style={{ display: settings.showPomodoro && !isTasksExpanded ? undefined : "none" }}
            >
              <CollapsibleCard
                title="Pomodoro"
                collapsed={!isTimerExpanded && isTimerCollapsed}
                onToggleCollapse={() => toggleCollapse("timer")}
                expandable
                expanded={isTimerExpanded}
                onToggleExpand={() => toggleExpand("timer")}
                className={isTimerExpanded ? "h-full flex flex-col items-center justify-center" : ""}
                contentClassName={isTimerExpanded ? "flex-1 flex items-center justify-center" : ""}
              >
                <PomodoroTimer onTimerEnd={handleTimerEnd} reloadRef={timerReloadRef} />
              </CollapsibleCard>
            </div>

            {/* Tasks card — always mounted, hidden via CSS */}
            <div
              className={`flex flex-col transition-all duration-300 ${isTasksExpanded ? "fixed inset-4 z-40" : ""}`}
              style={{ display: settings.showTasks && !isTimerExpanded ? undefined : "none" }}
            >
              <CollapsibleCard
                title="Tasks"
                collapsed={!isTasksExpanded && isTasksCollapsed}
                onToggleCollapse={() => toggleCollapse("tasks")}
                expandable
                expanded={isTasksExpanded}
                onToggleExpand={() => toggleExpand("tasks")}
                className={isTasksExpanded ? "h-full flex flex-col overflow-hidden" : ""}
                contentClassName={isTasksExpanded ? "flex-1 overflow-y-auto" : ""}
              >
                <TodoList reloadRef={todoReloadRef} />
              </CollapsibleCard>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

/* Reusable collapsible + expandable card */
const CollapsibleCard = ({
  title,
  collapsed,
  onToggleCollapse,
  expandable,
  expanded,
  onToggleExpand,
  children,
  className = "",
  contentClassName = "",
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) => (
  <div className={`w-full rounded-2xl border bg-card shadow-sm relative ${className}`}>
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-3">
      {!expanded && (
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          {title}
        </button>
      )}
      {expanded && <span className="text-sm font-semibold text-foreground">{title}</span>}
      {expandable && onToggleExpand && (
        <button
          onClick={onToggleExpand}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={expanded ? "Minimize" : "Maximize"}
        >
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
    {/* Content */}
    {!collapsed && (
      <div className={`px-6 pb-6 ${contentClassName}`}>
        {children}
      </div>
    )}
  </div>
);

export default Index;
