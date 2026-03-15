import { useCallback, useState, useEffect, useRef } from "react";
import PomodoroTimer from "@/components/PomodoroTimer";
import ClockDisplay from "@/components/ClockDisplay";
import TodoList from "@/components/TodoList";
import NotesList from "@/components/NotesList";
import {
  Timer, LogOut, Bell, BellOff, Maximize2, Minimize2,
  ChevronDown, ChevronUp, Columns2, Square, GripVertical,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
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
  const layoutSaveRef = useRef<NodeJS.Timeout | null>(null);
  const todoReloadRef = useRef<(() => void) | null>(null);
  const timerReloadRef = useRef<(() => void) | null>(null);
  const notesReloadRef = useRef<(() => void) | null>(null);
  const [expandedCard, setExpandedCard] = useState<CardId | null>(null);

  // Local layout state for instant UI updates, synced to DB
  const [localLayout, setLocalLayout] = useState<CardLayout>(settings.cardLayout);
  const localLayoutRef = useRef(localLayout);
  localLayoutRef.current = localLayout;

  // Sync from settings when they load/reload from DB
  useEffect(() => {
    setLocalLayout(settings.cardLayout);
  }, [settings.cardLayout]);

  // Debounced save to DB
  const saveLayout = useCallback((layout: CardLayout) => {
    if (layoutSaveRef.current) clearTimeout(layoutSaveRef.current);
    layoutSaveRef.current = setTimeout(() => {
      updateSettings({ cardLayout: layout });
    }, 500);
  }, [updateSettings]);

  const updateLocalLayout = useCallback((patch: Partial<CardLayout>) => {
    const next = { ...localLayoutRef.current, ...patch };
    setLocalLayout(next);
    saveLayout(next);
  }, [saveLayout]);

  const toggleCollapse = useCallback((card: string) => {
    setLocalLayout((prev) => {
      const collapsed = prev.collapsed.includes(card)
        ? prev.collapsed.filter((c) => c !== card)
        : [...prev.collapsed, card];
      const next = { ...prev, collapsed };
      saveLayout(next);
      return next;
    });
  }, [saveLayout]);

  const setCardWidth = useCallback((card: string, width: "full" | "half") => {
    updateLocalLayout({ widths: { ...localLayoutRef.current.widths, [card]: width } });
  }, [updateLocalLayout]);

  const onCardDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    const order = [...localLayoutRef.current.order];
    const [removed] = order.splice(source.index, 1);
    order.splice(destination.index, 0, removed);
    updateLocalLayout({ order });
  }, [updateLocalLayout]);

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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (layoutSaveRef.current) clearTimeout(layoutSaveRef.current);
      supabase.removeChannel(channel);
    };
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

  const isVisible = (card: CardId): boolean => {
    if (card === "clock") return true;
    if (card === "timer") return settings.showPomodoro;
    if (card === "tasks") return settings.showTasks;
    if (card === "notes") return settings.showNotes;
    return false;
  };

  const visibleCards = localLayout.order.filter((c) => isVisible(c as CardId)) as CardId[];

  const renderCardContent = (card: CardId) => {
    switch (card) {
      case "clock": return <ClockDisplay expanded={expandedCard === "clock"} />;
      case "timer": return <PomodoroTimer onTimerEnd={handleTimerEnd} reloadRef={timerReloadRef} />;
      case "tasks": return <TodoList reloadRef={todoReloadRef} />;
      case "notes": return <NotesList reloadRef={notesReloadRef} />;
    }
  };

  const getExpandedClasses = (card: CardId) => {
    if (card === "clock" || card === "timer") return "h-full flex flex-col items-center justify-center";
    return "h-full flex flex-col overflow-hidden";
  };

  const getExpandedContentClasses = (card: CardId) => {
    if (card === "clock" || card === "timer") return "flex-1 flex items-center justify-center";
    return "flex-1 overflow-y-auto";
  };

  // Build layout: use CSS grid with span for full-width items
  const getCardSpan = (card: CardId): boolean => {
    const width = localLayout.widths[card] || "full";
    return width === "full";
  };

  // Check if any visible card is half-width (to enable 2-col grid)
  const hasHalfWidth = visibleCards.some((c) => !getCardSpan(c));

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

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Fullscreen overlay */}
        {expandedCard && (
          <div className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm" onClick={() => setExpandedCard(null)} />
        )}

        {/* Expanded card */}
        {expandedCard && (
          <div className="fixed inset-4 z-40 transition-all duration-300">
            <CollapsibleCard
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

        {/* Draggable card grid */}
        {!expandedCard && (
          <DragDropContext onDragEnd={onCardDragEnd}>
            <Droppable droppableId="card-layout">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`grid gap-6 ${hasHalfWidth ? "lg:grid-cols-2 lg:gap-10" : ""}`}
                >
                  {visibleCards.map((card, index) => {
                    const isFullWidth = getCardSpan(card);
                    return (
                      <Draggable key={card} draggableId={card} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`${isFullWidth && hasHalfWidth ? "lg:col-span-2" : ""} ${card === "timer" ? "flex flex-col items-center" : ""} ${snapshot.isDragging ? "opacity-90 z-50" : ""}`}
                          >
                            <CollapsibleCard
                              title={CARD_LABELS[card]}
                              collapsed={localLayout.collapsed.includes(card)}
                              onToggleCollapse={() => toggleCollapse(card)}
                              expandable
                              expanded={false}
                              onToggleExpand={() => toggleExpand(card)}
                              width={localLayout.widths[card] as "full" | "half"}
                              onWidthToggle={() => setCardWidth(card, localLayout.widths[card] === "half" ? "full" : "half")}
                              dragHandleProps={provided.dragHandleProps}
                              isDragging={snapshot.isDragging}
                            >
                              {renderCardContent(card)}
                            </CollapsibleCard>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
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
  width,
  onWidthToggle,
  dragHandleProps,
  isDragging,
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
  width?: "full" | "half";
  onWidthToggle?: () => void;
  dragHandleProps?: any;
  isDragging?: boolean;
}) => (
  <div className={`w-full rounded-2xl border bg-card shadow-sm relative ${isDragging ? "shadow-lg ring-2 ring-primary/20" : ""} ${className}`}>
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-1">
        {/* Drag handle */}
        {!expanded && dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

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
      </div>

      <div className="flex items-center gap-0.5">
        {!expanded && onWidthToggle && (
          <button
            onClick={onWidthToggle}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-colors"
            aria-label={width === "half" ? "Full width" : "Half width"}
            title={width === "half" ? "Full width" : "Half width"}
          >
            {width === "half" ? <Square className="h-3 w-3" /> : <Columns2 className="h-3 w-3" />}
          </button>
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
