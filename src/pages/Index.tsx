import PomodoroTimer from "@/components/PomodoroTimer";
import TodoList from "@/components/TodoList";
import { Timer, LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Focusly</h1>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
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
              <PomodoroTimer />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="w-full rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold">Tasks</h2>
              <TodoList />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
