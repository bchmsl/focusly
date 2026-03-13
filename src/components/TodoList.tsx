import { useState } from "react";
import { Plus, X, Check } from "lucide-react";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const TodoList = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");

  const addTask = () => {
    const text = input.trim();
    if (!text) return;
    setTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, done: false },
    ]);
    setInput("");
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const pending = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  return (
    <div className="flex flex-col gap-4">
      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addTask();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 rounded-lg border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
        />
        <button
          type="submit"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:scale-105 active:scale-95"
          aria-label="Add task"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {/* Task list */}
      <div className="flex flex-col gap-1.5">
        {pending.length === 0 && completed.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tasks yet. Add one above to get started.
          </p>
        )}

        {pending.map((task) => (
          <div
            key={task.id}
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <button
              onClick={() => toggleTask(task.id)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-accent text-transparent transition-colors hover:border-primary hover:text-primary"
              aria-label="Complete task"
            >
              <Check className="h-3 w-3" />
            </button>
            <span className="flex-1 text-sm">{task.text}</span>
            <button
              onClick={() => removeTask(task.id)}
              className="flex h-6 w-6 items-center justify-center rounded text-transparent transition-colors group-hover:text-muted-foreground hover:!text-destructive"
              aria-label="Remove task"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {completed.length > 0 && (
          <>
            <div className="mt-3 mb-1 px-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Completed ({completed.length})
              </span>
            </div>
            {completed.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 task-done"
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-primary bg-primary text-primary-foreground"
                  aria-label="Undo complete"
                >
                  <Check className="h-3 w-3" />
                </button>
                <span className="flex-1 text-sm line-through text-muted-foreground">
                  {task.text}
                </span>
                <button
                  onClick={() => removeTask(task.id)}
                  className="flex h-6 w-6 items-center justify-center rounded text-transparent transition-colors group-hover:text-muted-foreground hover:!text-destructive"
                  aria-label="Remove task"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default TodoList;
