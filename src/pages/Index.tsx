import PomodoroTimer from "@/components/PomodoroTimer";
import TodoList from "@/components/TodoList";
import { Timer } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Focusly</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Timer column */}
          <div className="flex flex-col items-center">
            <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
              <PomodoroTimer />
            </div>
          </div>

          {/* Tasks column */}
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
