import { useState, useEffect, useCallback } from "react";
import { Plus, X, Check, ChevronUp, ChevronDown, ChevronRight, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Task {
  id: string;
  text: string;
  subtitle: string | null;
  body: string | null;
  done: boolean;
  position: number;
}

const TodoList = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ text: "", subtitle: "", body: "" });

  const loadTasks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, text, subtitle, body, done, position")
      .eq("user_id", user.id)
      .order("position", { ascending: true });
    if (data) setTasks(data as Task[]);
  }, [user]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const addTask = async () => {
    const text = input.trim();
    if (!text || !user) return;
    const id = crypto.randomUUID();
    const position = tasks.length;
    const newTask: Task = { id, text, subtitle: null, body: null, done: false, position };
    setTasks((prev) => [...prev, newTask]);
    setInput("");
    await supabase.from("tasks").insert({ id, user_id: user.id, text, done: false, position });
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

  const moveTask = async (id: string, direction: "up" | "down") => {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tasks.length) return;

    const updated = [...tasks];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    const reordered = updated.map((t, i) => ({ ...t, position: i }));
    setTasks(reordered);

    // Update both positions in DB
    await Promise.all([
      supabase.from("tasks").update({ position: reordered[idx].position }).eq("id", reordered[idx].id),
      supabase.from("tasks").update({ position: reordered[swapIdx].position }).eq("id", reordered[swapIdx].id),
    ]);
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditForm({ text: task.text, subtitle: task.subtitle || "", body: task.body || "" });
    setExpandedId(task.id);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const updates = {
      text: editForm.text.trim() || "Untitled",
      subtitle: editForm.subtitle.trim() || null,
      body: editForm.body.trim() || null,
    };
    setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...updates } : t)));
    setEditingId(null);
    await supabase.from("tasks").update(updates).eq("id", editingId);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const pending = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  const renderTask = (task: Task, isSortable: boolean) => {
    const isExpanded = expandedId === task.id;
    const isEditing = editingId === task.id;
    const hasDetails = task.subtitle || task.body;

    return (
      <div key={task.id} className="group rounded-lg border border-transparent transition-colors hover:border-border/50 hover:bg-muted/30">
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Reorder buttons */}
          {isSortable && (
            <div className="flex flex-col -my-1">
              <button
                onClick={() => moveTask(task.id, "up")}
                className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
                aria-label="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => moveTask(task.id, "down")}
                className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
                aria-label="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Checkbox */}
          <button
            onClick={() => toggleTask(task.id)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
              task.done
                ? "border-primary bg-primary text-primary-foreground"
                : "border-accent text-transparent hover:border-primary hover:text-primary"
            }`}
            aria-label={task.done ? "Undo complete" : "Complete task"}
          >
            <Check className="h-3 w-3" />
          </button>

          {/* Expand toggle */}
          {(hasDetails || isEditing) && (
            <button
              onClick={() => setExpandedId(isExpanded ? null : task.id)}
              className="p-0.5 text-muted-foreground/50 hover:text-foreground transition-all"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </button>
          )}

          {/* Title */}
          <div className="flex-1 min-w-0">
            <span className={`text-sm ${task.done ? "line-through text-muted-foreground" : ""}`}>
              {task.text}
            </span>
            {task.subtitle && !isExpanded && (
              <span className="ml-2 text-xs text-muted-foreground truncate">{task.subtitle}</span>
            )}
          </div>

          {/* Actions */}
          <button
            onClick={() => startEdit(task)}
            className="flex h-6 w-6 items-center justify-center rounded text-transparent transition-colors group-hover:text-muted-foreground hover:!text-primary"
            aria-label="Edit task"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            onClick={() => removeTask(task.id)}
            className="flex h-6 w-6 items-center justify-center rounded text-transparent transition-colors group-hover:text-muted-foreground hover:!text-destructive"
            aria-label="Remove task"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Expanded details / edit form */}
        {isExpanded && (
          <div className="px-3 pb-3 pl-12 space-y-2">
            {isEditing ? (
              <>
                <input
                  value={editForm.text}
                  onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))}
                  placeholder="Title"
                  className="w-full rounded-md border bg-card px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <input
                  value={editForm.subtitle}
                  onChange={(e) => setEditForm((f) => ({ ...f, subtitle: e.target.value }))}
                  placeholder="Subtitle (optional)"
                  className="w-full rounded-md border bg-card px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Notes / details (optional)"
                  rows={3}
                  className="w-full rounded-md border bg-card px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 resize-y"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {task.subtitle && (
                  <p className="text-xs font-medium text-muted-foreground">{task.subtitle}</p>
                )}
                {task.body && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{task.body}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

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

      <div className="flex flex-col gap-1">
        {pending.length === 0 && completed.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tasks yet. Add one above to get started.
          </p>
        )}

        {pending.map((task) => renderTask(task, true))}

        {completed.length > 0 && (
          <>
            <div className="mt-3 mb-1 px-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Completed ({completed.length})
              </span>
            </div>
            {completed.map((task) => renderTask(task, false))}
          </>
        )}
      </div>
    </div>
  );
};

export default TodoList;
