import { useState, useEffect, useCallback } from "react";
import { Plus, X, Check, ChevronRight, Edit2, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Task {
  id: string;
  text: string;
  subtitle: string | null;
  body: string | null;
  done: boolean;
  position: number;
  parent_id: string | null;
}

const TodoList = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ text: "", subtitle: "", body: "" });
  const [subtaskInputId, setSubtaskInputId] = useState<string | null>(null);
  const [subtaskInput, setSubtaskInput] = useState("");

  const loadTasks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, text, subtitle, body, done, position, parent_id")
      .eq("user_id", user.id)
      .order("position", { ascending: true });
    if (data) setTasks(data as Task[]);
  }, [user]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const getSubtasks = (parentId: string) =>
    tasks.filter((t) => t.parent_id === parentId).sort((a, b) => a.position - b.position);
  const topLevel = tasks.filter((t) => !t.parent_id);

  const addTask = async (parentId: string | null = null, text?: string) => {
    const value = (text ?? input).trim();
    if (!value || !user) return;
    const id = crypto.randomUUID();
    const siblings = parentId ? getSubtasks(parentId) : topLevel;
    const position = siblings.length;
    const newTask: Task = { id, text: value, subtitle: null, body: null, done: false, position, parent_id: parentId };
    setTasks((prev) => [...prev, newTask]);
    if (!parentId) setInput("");
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
    const subtaskIds = getSubtasks(id).map((s) => s.id);
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
      updated
        .filter((t, i) => list[i]?.id !== t.id)
        .map((t) => supabase.from("tasks").update({ position: t.position }).eq("id", t.id))
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
      const subs = getSubtasks(parentId);
      reorder(subs, source.index, destination.index);
    }
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

  const cancelEdit = () => setEditingId(null);

  const renderTaskContent = (task: Task, isSubtask: boolean, dragHandleProps?: any) => {
    const isExpanded = expandedId === task.id;
    const isEditing = editingId === task.id;
    const hasDetails = task.subtitle || task.body;
    const subtasks = getSubtasks(task.id);
    const hasSubtasks = subtasks.length > 0;
    const hasExpandable = hasDetails || isEditing || hasSubtasks || !isSubtask;

    return (
      <div className="rounded-lg border border-transparent transition-colors hover:border-border/50 hover:bg-muted/30">
        <div className="group flex items-center gap-2 px-3 py-2.5">
          {/* Drag handle */}
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/30 hover:text-muted-foreground transition-colors">
            <GripVertical className="h-4 w-4" />
          </div>

          <button
            onClick={() => toggleTask(task.id)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
              task.done ? "border-primary bg-primary text-primary-foreground" : "border-accent text-transparent hover:border-primary hover:text-primary"
            }`}
            aria-label={task.done ? "Undo complete" : "Complete task"}
          >
            <Check className="h-3 w-3" />
          </button>

          {hasExpandable && (
            <button onClick={() => setExpandedId(isExpanded ? null : task.id)} className="p-0.5 text-muted-foreground/50 hover:text-foreground transition-all">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <span className={`text-sm ${task.done ? "line-through text-muted-foreground" : ""}`}>{task.text}</span>
            {task.subtitle && !isExpanded && <span className="ml-2 text-xs text-muted-foreground truncate">{task.subtitle}</span>}
            {hasSubtasks && !isExpanded && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({subtasks.filter((s) => s.done).length}/{subtasks.length})
              </span>
            )}
          </div>

          <button onClick={() => startEdit(task)} className="flex h-6 w-6 items-center justify-center rounded text-transparent transition-colors group-hover:text-muted-foreground hover:!text-primary" aria-label="Edit task">
            <Edit2 className="h-3 w-3" />
          </button>
          <button onClick={() => removeTask(task.id)} className="flex h-6 w-6 items-center justify-center rounded text-transparent transition-colors group-hover:text-muted-foreground hover:!text-destructive" aria-label="Remove task">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {isExpanded && (
          <div className="px-3 pb-3 pl-14 space-y-2">
            {isEditing ? (
              <>
                <input value={editForm.text} onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))} placeholder="Title" className="w-full rounded-md border bg-card px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" />
                <input value={editForm.subtitle} onChange={(e) => setEditForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="Subtitle (optional)" className="w-full rounded-md border bg-card px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" />
                <textarea value={editForm.body} onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))} placeholder="Notes / details (optional)" rows={3} className="w-full rounded-md border bg-card px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 resize-y" />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors">Save</button>
                  <button onClick={cancelEdit} className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground hover:bg-muted/80 transition-colors">Cancel</button>
                </div>
              </>
            ) : (
              <>
                {task.subtitle && <p className="text-xs font-medium text-muted-foreground">{task.subtitle}</p>}
                {task.body && <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{task.body}</p>}
              </>
            )}

            {/* Subtasks with drag-drop */}
            {!isSubtask && (
              <Droppable droppableId={`subtasks-${task.id}`}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                    {subtasks.map((sub, index) => (
                      <Draggable key={sub.id} draggableId={sub.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={snapshot.isDragging ? "opacity-80" : ""}
                          >
                            {renderTaskContent(sub, true, provided.dragHandleProps)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}

            {/* Add subtask */}
            {!isSubtask && (
              subtaskInputId === task.id ? (
                <form onSubmit={(e) => { e.preventDefault(); addSubtask(task.id); }} className="flex gap-2 mt-1">
                  <input
                    autoFocus
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    placeholder="Add subtask..."
                    className="flex-1 rounded-md border bg-card px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                    onBlur={() => { if (!subtaskInput.trim()) setSubtaskInputId(null); }}
                  />
                  <button type="submit" className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => { setSubtaskInputId(task.id); setSubtaskInput(""); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                >
                  <Plus className="h-3 w-3" /> Add subtask
                </button>
              )
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
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add a new task..." className="flex-1 rounded-lg border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow" />
        <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:scale-105 active:scale-95" aria-label="Add task">
          <Plus className="h-4 w-4" />
        </button>
      </form>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-1">
          {pendingTop.length === 0 && completedTop.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No tasks yet. Add one above to get started.</p>
          )}

          <Droppable droppableId="pending">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1">
                {pendingTop.map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={snapshot.isDragging ? "opacity-80" : ""}
                      >
                        {renderTaskContent(task, false, provided.dragHandleProps)}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {completedTop.length > 0 && (
            <>
              <div className="mt-3 mb-1 px-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed ({completedTop.length})</span>
              </div>
              {completedTop.map((task) => (
                <div key={task.id}>{renderTaskContent(task, false)}</div>
              ))}
            </>
          )}
        </div>
      </DragDropContext>
    </div>
  );
};

export default TodoList;
