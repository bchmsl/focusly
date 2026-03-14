import { useCallback, useState } from "react";
import PomodoroTimer from "@/components/PomodoroTimer";
import TodoList from "@/components/TodoList";
import { Timer, LogOut, Bell, BellOff } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import SettingsPanel from "@/components/SettingsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useSettings } from "@/contexts/SettingsContext";
import { useTheme } from "@/contexts/ThemeContext";

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const { permission, subscribed, subscribe, sendNotification, isSupported } = usePushNotifications();
  const { reload: reloadSettings } = useSettings();
  const { reload: reloadTheme } = useTheme();

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <button
            onClick={async () => {
              setSpinning(true);
              setContentKey((k) => k + 1);
              await Promise.all([reloadSettings(), reloadTheme()]);
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

            {/* Push notification toggle */}
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

            <SettingsPanel onTagsChanged={() => setContentKey((v) => v + 1)} />
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
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-center">
            <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
              <PomodoroTimer key={contentKey} onTimerEnd={handleTimerEnd} />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="w-full rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold">Tasks</h2>
              <TodoList key={contentKey} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
