import { useCallback, useState, useEffect, useRef } from "react";
import PomodoroTimer from "@/components/PomodoroTimer";
import ClockDisplay from "@/components/ClockDisplay";
import TodoList from "@/components/TodoList";
import NotesList from "@/components/NotesList";
import {
  Timer, LogOut, Bell, BellOff, Maximize2, Minimize2,
  ChevronDown, ChevronUp, ArrowUp, ArrowDown, Columns2, Square,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import SettingsPanel from "@/components/SettingsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useSettings, type CardLayout } from "@/contexts/SettingsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";

type CardId = "clock" | "timer" | "tasks" | "notes";

const CARD_LABELS: Record<CardId, string> = {
  clock: "Clock",
  timer: "Pomodoro",
  tasks: "Tasks",
  notes: "Notes",
};

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(false);
  const { permission, subscribed, subscribe, sendNotification, isSupported } = usePushNotifications();
  const { settings, updateSettings, reload: reloadSettings } = useSettings();
  const { reload: reloadTheme } = useTheme();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const todoReloadRef = useRef<(() => void) | null>(null);
  const timerReloadRef = useRef<(() => void) | null>(null);
  const notesReloadRef = useRef<(() => void) | null>(null);
  const [expandedCard, setExpandedCard] = useState<CardId | null>(null);

  const layout = settings.cardLayout;

  const updateLayout = useCallback((patch: Partial<CardLayout>) => {
    updateSettings({ cardLayout: { ...layout, ...patch } });
  }, [layout, updateSettings]);

  const toggleCollapse = useCallback((card: string) => {
    const collapsed = layout.collapsed.includes(card)
      ? layout.collapsed.filter((c) => c !== card)
      : [...layout.collapsed, card];
    updateLayout({ collapsed });
  }, [layout, updateLayout]);

  const setCardWidth = useCallback((card: string, width: "full" | "half") => {
    updateLayout({ widths: { ...layout.widths, [card]: width } });
  }, [layout, updateLayout]);

  const moveCard = useCallback((card: string, direction: -1 | 1) => {
    const order = [...layout.order];
    const idx = order.indexOf(card);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    updateLayout({ order });
  }, [layout, updateLayout]);

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

  const toggleExpand = (card: CardId) => {
    setExpandedCard((prev) => (prev === card ? null : card));
  };

  // Visibility map
  const isVisible = (card: CardId): boolean => {
    if (card === "clock") return true;
    if (card === "timer") return settings.showPomodoro;
    if (card === "tasks") return settings.showTasks;
    if (card === "notes") return settings.showNotes;
    return false;
  };

  // Visible, ordered cards (not expanded)
  const visibleCards = layout.order.filter((c) => isVisible(c as CardId)) as CardId[];

  // Card content renderer
  const renderCardContent = (card: CardId) => {
    switch (card) {
      case "clock": return <ClockDisplay expanded={expandedCard === "clock"} />;
      case "timer": return <PomodoroTimer onTimerEnd={handleTimerEnd} reloadRef={timerReloadRef} />;
      case "tasks": return <TodoList reloadRef={todoReloadRef} />;
      case "notes": return <NotesList reloadRef={notesReloadRef} />;
    }
  };

  // Group visible cards into layout rows (pairs of half-width or single full-width)
  const buildRows = (): CardId[][] => {
    if (expandedCard) return [];
    const rows: CardId[][] = [];
    let halfBuffer: CardId[] = [];

    for (const card of visibleCards) {
      const width = layout.widths[card] || "full";
      if (width === "half") {
        halfBuffer.push(card);
        if (halfBuffer.length === 2) {
          rows.push([...halfBuffer]);
          halfBuffer = [];
        }
      } else {
        if (halfBuffer.length > 0) {
          rows.push([...halfBuffer]);
          halfBuffer = [];
        }
        rows.push([card]);
      }
    }
    if (halfBuffer.length > 0) rows.push([...halfBuffer]);
    return rows;
  };

  const rows = buildRows();

  const getExpandedClasses = (card: CardId) => {
    if (card === "clock") return "h-full flex flex-col items-center justify-center";
    if (card === "timer") return "h-full flex flex-col items-center justify-center";
    return "h-full flex flex-col overflow-hidden";
  };

  const getExpandedContentClasses = (card: CardId) => {
    if (card === "clock") return "flex-1 flex items-center justify-center";
    if (card === "timer") return "flex-1 flex items-center justify-center";
    return "flex-1 overflow-y-auto";
  };

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
            <SettingsPanel onTagsChanged={() => { todoReloadRef.current?.(); notesReloadRef.current?.(); }} />
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

        {/* Expanded card */}
        {expandedCard && (
          <div className="fixed inset-4 z-40 transition-all duration-300">
            <CollapsibleCard
              cardId={expandedCard}
              title={CARD_LABELS[expandedCard]}
              collapsed={false}
              onToggleCollapse={() => {}}
              expandable
              expanded
              onToggleExpand={() => toggleExpand(expandedCard)}
              className={getExpandedClasses(expandedCard)}
              contentClassName={getExpandedContentClasses(expandedCard)}
            >
              {renderCardContent(expandedCard)}
            </CollapsibleCard>
          </div>
        )}

        {/* Normal layout rows */}
        {!expandedCard && rows.map((row, ri) => {
          if (row.length === 2) {
            return (
              <div key={row.join("-")} className="grid gap-6 lg:grid-cols-2 lg:gap-10">
                {row.map((card) => (
                  <div key={card} className={`flex flex-col ${card === "timer" ? "items-center" : ""}`}>
                    <CollapsibleCard
                      cardId={card}
                      title={CARD_LABELS[card]}
                      collapsed={layout.collapsed.includes(card)}
                      onToggleCollapse={() => toggleCollapse(card)}
                      expandable
                      expanded={false}
                      onToggleExpand={() => toggleExpand(card)}
                      width={layout.widths[card] as "full" | "half"}
                      onWidthToggle={() => setCardWidth(card, layout.widths[card] === "half" ? "full" : "half")}
                      onMoveUp={visibleCards.indexOf(card) > 0 ? () => moveCard(card, -1) : undefined}
                      onMoveDown={visibleCards.indexOf(card) < visibleCards.length - 1 ? () => moveCard(card, 1) : undefined}
                    >
                      {renderCardContent(card)}
                    </CollapsibleCard>
                  </div>
                ))}
              </div>
            );
          }

          const card = row[0];
          return (
            <div key={card} className={`${card === "timer" ? "flex flex-col items-center" : ""}`}>
              <CollapsibleCard
                cardId={card}
                title={CARD_LABELS[card]}
                collapsed={layout.collapsed.includes(card)}
                onToggleCollapse={() => toggleCollapse(card)}
                expandable
                expanded={false}
                onToggleExpand={() => toggleExpand(card)}
                width={layout.widths[card] as "full" | "half"}
                onWidthToggle={() => setCardWidth(card, layout.widths[card] === "half" ? "full" : "half")}
                onMoveUp={visibleCards.indexOf(card) > 0 ? () => moveCard(card, -1) : undefined}
                onMoveDown={visibleCards.indexOf(card) < visibleCards.length - 1 ? () => moveCard(card, 1) : undefined}
              >
                {renderCardContent(card)}
              </CollapsibleCard>
            </div>
          );
        })}
      </main>
    </div>
  );
};

/* Reusable collapsible + expandable card */
const CollapsibleCard = ({
  cardId,
  title,
  collapsed,
  onToggleCollapse,
  expandable,
  expanded,
  onToggleExpand,
  children,
  className = "",
  contentClassName = "",
  width,
  onWidthToggle,
  onMoveUp,
  onMoveDown,
}: {
  cardId: string;
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  width?: "full" | "half";
  onWidthToggle?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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

      <div className="flex items-center gap-0.5">
        {/* Reorder & width controls — only when not expanded */}
        {!expanded && (
          <>
            {onMoveUp && (
              <button
                onClick={onMoveUp}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Move up"
                title="Move up"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
            )}
            {onMoveDown && (
              <button
                onClick={onMoveDown}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Move down"
                title="Move down"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            )}
            {onWidthToggle && (
              <button
                onClick={onWidthToggle}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-colors"
                aria-label={width === "half" ? "Full width" : "Half width"}
                title={width === "half" ? "Full width" : "Half width"}
              >
                {width === "half" ? <Square className="h-3 w-3" /> : <Columns2 className="h-3 w-3" />}
              </button>
            )}
          </>
        )}
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
