import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, Check, ChevronRight, Edit2, GripVertical, Pencil } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Task {
  id: string;
  text: string;
  body: string | null;
  done: boolean;
  position: number;
  parent_id: string | null;
}

const TodoList = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ text: "", body: "" });
  const [subtaskInputId, setSubtaskInputId] = useState<string | null>(null);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskText, setEditingSubtaskText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadTasks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, text, body, done, position, parent_id")
      .eq("user_id", user.id)
      .order("position", { ascending: true });
    if (data) setTasks(data as Task[]);
  }, [user]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Helpers
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const expand = (id: string) => setExpandedIds((prev) => new Set(prev).add(id));

  const getSubtasks = (parentId: string) =>
    tasks.filter((t) => t.parent_id === parentId).sort((a, b) => a.position - b.position);
  const topLevel = tasks.filter((t) => !t.parent_id);

  const addTask = async (parentId: string | null = null, text?: string) => {
    const value = (text ?? input).trim();
    if (!value || !user) return;
    const id = crypto.randomUUID();
    const siblings = parentId ? getSubtasks(parentId) : topLevel;
    const position = siblings.length;
    const newTask: Task = { id, text: value, body: null, done: false, position, parent_id: parentId };
    setTasks((prev) => [...prev, newTask]);
    if (!parentId) {
      setInput("");
      inputRef.current?.focus();
    }
    await supabase.from("tasks").insert({ id, user_id: user.id, text: value, done: false, position, parent_id: parentId } as any);
  };

  const addSubtask = async (parentId: string) => {
    const text = subtaskInput.trim();
    if (!text) return;
    await addTask(parentId, text);
    setSubtaskInput("");
    setSubtaskInputId(null);
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newDone = !task.done;
    const subtaskIds = task.parent_id ? [] : getSubtasks(id).map((s) => s.id);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id || subtaskIds.includes(t.id) ? { ...t, done: newDone } : t
      )
    );
    await supabase.from("tasks").update({ done: newDone }).eq("id", id);
    if (subtaskIds.length > 0) {
      await Promise.all(subtaskIds.map((sid) => supabase.from("tasks").update({ done: newDone }).eq("id", sid)));
    }
  };

  const removeTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parent_id !== id));
    setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    if (editingId === id) setEditingId(null);
    await supabase.from("tasks").delete().eq("id", id);
  };

  const reorder = async (list: Task[], startIndex: number, endIndex: number) => {
    const result = [...list];
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    const updated = result.map((t, i) => ({ ...t, position: i }));
    setTasks((prev) => {
      const ids = new Set(updated.map((u) => u.id));
      return [...prev.filter((t) => !ids.has(t.id)), ...updated];
    });
    await Promise.all(
      updated.filter((t, i) => list[i]?.id !== t.id).map((t) => supabase.from("tasks").update({ position: t.position }).eq("id", t.id))
    );
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index && source.droppableId === destination.droppableId) return;
    const droppableId = source.droppableId;
    if (droppableId === "pending") {
      const pending = topLevel.filter((t) => !t.done).sort((a, b) => a.position - b.position);
      reorder(pending, source.index, destination.index);
    } else if (droppableId.startsWith("subtasks-")) {
      const parentId = droppableId.replace("subtasks-", "");
      reorder(getSubtasks(parentId), source.index, destination.index);
    }
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditForm({ text: task.text, body: task.body || "" });
    expand(task.id);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const updates = { text: editForm.text.trim() || "Untitled", body: editForm.body.trim() || null };
    const task = tasks.find((t) => t.id === editingId);
    const subtasks = task ? getSubtasks(task.id) : [];
    setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...updates } : t)));
    // Auto-collapse if no content to show
    if (!updates.body && subtasks.length === 0) {
      setExpandedIds((prev) => { const next = new Set(prev); next.delete(editingId); return next; });
    }
    setEditingId(null);
    setSubtaskInputId(null);
    await supabase.from("tasks").update(updates).eq("id", editingId);
  };

  const saveSubtaskTitle = async (id: string) => {
    const text = editingSubtaskText.trim() || "Untitled";
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
    setEditingSubtaskId(null);
    await supabase.from("tasks").update({ text }).eq("id", id);
  };

  const cancelEdit = () => {
    if (!editingId) return;
    const task = tasks.find((t) => t.id === editingId);
    const subtasks = task ? getSubtasks(task.id) : [];
    // Auto-collapse if no content
    if (!task?.body && subtasks.length === 0) {
      setExpandedIds((prev) => { const next = new Set(prev); next.delete(editingId); return next; });
    }
    setEditingId(null);
    setSubtaskInputId(null);
  };

  // Keyboard: Escape cancels edit globally
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingSubtaskId) { setEditingSubtaskId(null); return; }
        if (subtaskInputId) { setSubtaskInputId(null); return; }
        if (editingId) { cancelEdit(); return; }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const renderSubtask = (task: Task, dragHandleProps?: any) => (
    <div className="group rounded-md transition-colors hover:bg-muted/40">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-muted-foreground transition-colors">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <button
          onClick={() => toggleTask(task.id)}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            task.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-transparent hover:border-primary hover:text-primary"
          }`}
          aria-label={task.done ? "Undo complete" : "Complete subtask"}
        >
          <Check className="h-2.5 w-2.5" />
        </button>
        {editingSubtaskId === task.id ? (
          <input
            autoFocus
            value={editingSubtaskText}
            onChange={(e) => setEditingSubtaskText(e.target.value)}
            onBlur={() => saveSubtaskTitle(task.id)}
            onKeyDown={(e) => { if (e.key === "Enter") saveSubtaskTitle(task.id); }}
            className="flex-1 rounded border bg-card px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        ) : (
          <span
            onClick={() => { setEditingSubtaskId(task.id); setEditingSubtaskText(task.text); }}
            className={`flex-1 text-xs cursor-text select-none ${task.done ? "line-through text-muted-foreground" : ""}`}
          >
            {task.text}
          </span>
        )}
        <button
          onClick={() => removeTask(task.id)}
          className="flex h-5 w-5 items-center justify-center rounded text-transparent transition-colors group-hover:text-muted-foreground/50 hover:!text-destructive"
          aria-label="Remove subtask"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );

  const renderTaskContent = (task: Task, isDraggable: boolean, dragHandleProps?: any) => {
    const isExpanded = expandedIds.has(task.id);
    const isEditing = editingId === task.id;
    const subtasks = getSubtasks(task.id);
    const hasSubtasks = subtasks.length > 0;
    const hasContent = !!task.body || hasSubtasks;

    return (
      <div className={`rounded-xl border transition-all ${isExpanded ? "border-border/60 bg-card shadow-sm" : "border-transparent hover:border-border/30 hover:bg-muted/30"}`}>
        <div className="group flex items-center gap-2 px-3 py-2.5">
          {/* Drag handle — hidden for completed tasks */}
          {isDraggable ? (
            <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-muted-foreground transition-colors">
              <GripVertical className="h-4 w-4" />
            </div>
          ) : (
            <div className="w-5" /> /* spacer for alignment */
          )}

          <button
            onClick={() => toggleTask(task.id)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
              task.done
                ? "border-primary bg-primary text-primary-foreground scale-100"
                : "border-muted-foreground/30 text-transparent hover:border-primary hover:text-primary hover:scale-110"
            }`}
            aria-label={task.done ? "Undo complete" : "Complete task"}
          >
            <Check className="h-3 w-3" />
          </button>

          {/* Expand chevron — only if there's content or it's already expanded */}
          {(hasContent || isExpanded) ? (
            <button onClick={() => toggleExpanded(task.id)} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-all">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <div className="w-5" />
          )}

          {/* Title — click to expand if has content */}
          <div
            className="flex-1 min-w-0 cursor-default"
            onClick={() => { if (hasContent && !isExpanded) toggleExpanded(task.id); }}
          >
            <span className={`text-sm transition-colors ${task.done ? "line-through text-muted-foreground" : ""}`}>
              {task.text}
            </span>
            {hasSubtasks && !isExpanded && (
              <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {subtasks.filter((s) => s.done).length}/{subtasks.length}
              </span>
            )}
          </div>

          {/* Edit button */}
          <button
            onClick={() => isEditing ? saveEdit() : startEdit(task)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
              isEditing
                ? "bg-primary/10 text-primary"
                : "text-transparent group-hover:text-muted-foreground hover:!text-primary hover:!bg-primary/5"
            }`}
            aria-label={isEditing ? "Save" : "Edit task"}
          >
            {isEditing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3 w-3" />}
          </button>

          {/* Delete */}
          <button
            onClick={() => removeTask(task.id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-transparent transition-all group-hover:text-muted-foreground/50 hover:!text-destructive hover:!bg-destructive/5"
            aria-label="Remove task"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-3 pb-3 pl-[3.25rem] space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={editForm.text}
                  onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
                  placeholder="Title"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
                />
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Notes / details (optional)"
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 resize-y transition-shadow"
                />

                {/* Add subtask area */}
                <div className="pt-1">
                  {subtaskInputId === task.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); addSubtask(task.id); }} className="flex gap-2">
                      <input
                        autoFocus
                        value={subtaskInput}
                        onChange={(e) => setSubtaskInput(e.target.value)}
                        placeholder="Subtask title..."
                        className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                        onKeyDown={(e) => { if (e.key === "Escape") setSubtaskInputId(null); }}
                      />
                      <button type="submit" className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 transition-colors">
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => { setSubtaskInputId(task.id); setSubtaskInput(""); }}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add subtask
                    </button>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={saveEdit} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                    Save
                  </button>
                  <button onClick={cancelEdit} className="rounded-lg px-4 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {task.body && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed rounded-lg bg-muted/30 px-3 py-2">
                    {task.body}
                  </p>
                )}
              </>
            )}

            {/* Subtasks always visible when expanded */}
            {hasSubtasks && (
              <Droppable droppableId={`subtasks-${task.id}`}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0.5 pt-1">
                    {subtasks.map((sub, index) => (
                      <Draggable key={sub.id} draggableId={sub.id} index={index}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} className={`transition-shadow ${snapshot.isDragging ? "opacity-90 shadow-md rounded-md" : ""}`}>
                            {renderSubtask(sub, provided.dragHandleProps)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}
          </div>
        )}
      </div>
    );
  };

  const pendingTop = topLevel.filter((t) => !t.done).sort((a, b) => a.position - b.position);
  const completedTop = topLevel.filter((t) => t.done).sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => { e.preventDefault(); addTask(); }} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 rounded-xl border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          aria-label="Add task"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-0.5">
          {pendingTop.length === 0 && completedTop.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No tasks yet — type above to get started.
            </p>
          )}

          <Droppable droppableId="pending">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-0.5">
                {pendingTop.map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`transition-shadow ${snapshot.isDragging ? "opacity-90 shadow-lg rounded-xl" : ""}`}
                      >
                        {renderTaskContent(task, true, provided.dragHandleProps)}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {completedTop.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 px-3">
                <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                  Completed · {completedTop.length}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 opacity-75">
                {completedTop.map((task) => (
                  <div key={task.id}>{renderTaskContent(task, false)}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DragDropContext>
    </div>
  );
};

export default TodoList;
