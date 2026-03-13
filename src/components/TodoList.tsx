import { useState, useEffect, useCallback } from "react";
import { Plus, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const TodoList = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");

  // Load tasks from DB
  const loadTasks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, text, done")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (data) setTasks(data);
  }, [user]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const addTask = async () => {
    const text = input.trim();
    if (!text || !user) return;
    const id = crypto.randomUUID();
    setTasks((prev) => [...prev, { id, text, done: false }]);
    setInput("");
    await supabase.from("tasks").insert({ id, user_id: user.id, text, done: false });
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newDone = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: newDone } : t)));
    await supabase.from("tasks").update({ done: newDone }).eq("id", id);
  };

  const removeTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const pending = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => { e.preventDefault(); addTask(); }}
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

      <div className="flex flex-col gap-1.5">
        {pending.length === 0 && completed.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tasks yet. Add one above to get started.
          </p>
        )}

        {pending.map((task) => (
          <div key={task.id} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50">
            <button onClick={() => toggleTask(task.id)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-accent text-transparent transition-colors hover:border-primary hover:text-primary" aria-label="Complete task">
              <Check className="h-3 w-3" />
            </button>
            <span className="flex-1 text-sm">{task.text}</span>
            <button onClick={() => removeTask(task.id)} className="flex h-6 w-6 items-center justify-center rounded text-transparent transition-colors group-hover:text-muted-foreground hover:!text-destructive" aria-label="Remove task">
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
              <div key={task.id} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 task-done">
                <button onClick={() => toggleTask(task.id)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-primary bg-primary text-primary-foreground" aria-label="Undo complete">
                  <Check className="h-3 w-3" />
                </button>
                <span className="flex-1 text-sm line-through text-muted-foreground">{task.text}</span>
                <button onClick={() => removeTask(task.id)} className="flex h-6 w-6 items-center justify-center rounded text-transparent transition-colors group-hover:text-muted-foreground hover:!text-destructive" aria-label="Remove task">
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
