import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, Check, ChevronRight, GripVertical, Pencil, Tag, Filter } from "lucide-react";
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

interface TagType {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

const TAG_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#64748b",
];

const TodoList = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [taskTagMap, setTaskTagMap] = useState<Record<string, string[]>>({}); // taskId -> tagId[]
  const [input, setInput] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ text: "", body: "" });
  const [subtaskInputId, setSubtaskInputId] = useState<string | null>(null);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskText, setEditingSubtaskText] = useState("");
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [showTagCreator, setShowTagCreator] = useState<string | null>(null); // taskId
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagEmoji, setNewTagEmoji] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Load data
  const loadTasks = useCallback(async () => {
    if (!user) return;
    const [{ data: taskData }, { data: tagData }, { data: ttData }] = await Promise.all([
      supabase.from("tasks").select("id, text, body, done, position, parent_id").eq("user_id", user.id).order("position", { ascending: true }),
      supabase.from("tags").select("id, name, color, emoji").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("task_tags").select("task_id, tag_id"),
    ]);
    if (taskData) setTasks(taskData as Task[]);
    if (tagData) setTags(tagData as TagType[]);
    if (ttData) {
      const map: Record<string, string[]> = {};
      for (const row of ttData) {
        if (!map[row.task_id]) map[row.task_id] = [];
        map[row.task_id].push(row.tag_id);
      }
      setTaskTagMap(map);
    }
  }, [user]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Helpers
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const expand = (id: string) => setExpandedIds((prev) => new Set(prev).add(id));
  const getSubtasks = (parentId: string) => tasks.filter((t) => t.parent_id === parentId).sort((a, b) => a.position - b.position);
  const topLevel = tasks.filter((t) => !t.parent_id);
  const getTaskTags = (taskId: string) => (taskTagMap[taskId] || []).map((tid) => tags.find((t) => t.id === tid)).filter(Boolean) as TagType[];

  // Tag operations
  const createTag = async (taskId: string) => {
    if (!user || !newTagName.trim()) return;
    const existingTag = tags.find((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase());
    if (existingTag) {
      await toggleTagOnTask(taskId, existingTag.id);
      setNewTagName("");
      setShowTagCreator(null);
      return;
    }
    const id = crypto.randomUUID();
    const tag: TagType = { id, name: newTagName.trim(), color: newTagColor, emoji: newTagEmoji.trim() || null };
    setTags((prev) => [...prev, tag]);
    await supabase.from("tags").insert({ id, user_id: user.id, name: tag.name, color: tag.color, emoji: tag.emoji } as any);
    await toggleTagOnTask(taskId, id);
    setNewTagName("");
    setNewTagEmoji("");
    setShowTagCreator(null);
  };

  const toggleTagOnTask = async (taskId: string, tagId: string) => {
    const current = taskTagMap[taskId] || [];
    if (current.includes(tagId)) {
      setTaskTagMap((prev) => ({ ...prev, [taskId]: current.filter((id) => id !== tagId) }));
      await supabase.from("task_tags").delete().eq("task_id", taskId).eq("tag_id", tagId);
    } else {
      setTaskTagMap((prev) => ({ ...prev, [taskId]: [...current, tagId] }));
      await supabase.from("task_tags").insert({ task_id: taskId, tag_id: tagId } as any);
    }
  };

  const deleteTag = async (tagId: string) => {
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    setTaskTagMap((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].filter((id) => id !== tagId);
      }
      return next;
    });
    if (activeFilterTag === tagId) setActiveFilterTag(null);
    await supabase.from("tags").delete().eq("id", tagId);
  };

  // Task operations
  const addTask = async (parentId: string | null = null, text?: string) => {
    const value = (text ?? input).trim();
    if (!value || !user) return;
    const id = crypto.randomUUID();
    const siblings = parentId ? getSubtasks(parentId) : topLevel;
    const position = siblings.length;
    const newTask: Task = { id, text: value, body: null, done: false, position, parent_id: parentId };
    setTasks((prev) => [...prev, newTask]);
    if (!parentId) { setInput(""); inputRef.current?.focus(); }
    await supabase.from("tasks").insert({ id, user_id: user.id, text: value, done: false, position, parent_id: parentId } as any);
  };

  const addSubtask = async (parentId: string) => {
    const text = subtaskInput.trim();
    if (!text) return;
    await addTask(parentId, text);
    setSubtaskInput("");
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newDone = !task.done;
    const subtaskIds = task.parent_id ? [] : getSubtasks(id).map((s) => s.id);
    setTasks((prev) => prev.map((t) => t.id === id || subtaskIds.includes(t.id) ? { ...t, done: newDone } : t));
    await supabase.from("tasks").update({ done: newDone }).eq("id", id);
    if (subtaskIds.length > 0) await Promise.all(subtaskIds.map((sid) => supabase.from("tasks").update({ done: newDone }).eq("id", sid)));
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
    setTasks((prev) => { const ids = new Set(updated.map((u) => u.id)); return [...prev.filter((t) => !ids.has(t.id)), ...updated]; });
    await Promise.all(updated.filter((t, i) => list[i]?.id !== t.id).map((t) => supabase.from("tasks").update({ position: t.position }).eq("id", t.id)));
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
      reorder(getSubtasks(droppableId.replace("subtasks-", "")), source.index, destination.index);
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
    const taskTags = getTaskTags(editingId);
    setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...updates } : t)));
    if (!updates.body && subtasks.length === 0 && taskTags.length === 0) {
      setExpandedIds((prev) => { const next = new Set(prev); next.delete(editingId); return next; });
    }
    setEditingId(null);
    setSubtaskInputId(null);
    setShowTagCreator(null);
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
    const taskTags = getTaskTags(editingId);
    if (!task?.body && subtasks.length === 0 && taskTags.length === 0) {
      setExpandedIds((prev) => { const next = new Set(prev); next.delete(editingId); return next; });
    }
    setEditingId(null);
    setSubtaskInputId(null);
    setShowTagCreator(null);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showTagCreator) { setShowTagCreator(null); return; }
        if (editingSubtaskId) { setEditingSubtaskId(null); return; }
        if (subtaskInputId) { setSubtaskInputId(null); return; }
        if (editingId) { cancelEdit(); return; }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Tag pill component
  const TagPill = ({ tag, size = "sm", onRemove, onClick }: { tag: TagType; size?: "sm" | "xs"; onRemove?: () => void; onClick?: () => void }) => (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 rounded-full font-medium transition-colors ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-1.5 py-px text-[9px]"
      } ${onClick ? "cursor-pointer hover:opacity-80" : ""}`}
      style={{ backgroundColor: tag.color + "20", color: tag.color }}
    >
      {tag.emoji && <span className="text-[10px]">{tag.emoji}</span>}
      {tag.name}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5 hover:opacity-60">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );

  // Tag editor inside edit mode
  const renderTagEditor = (taskId: string) => {
    const taskTags = getTaskTags(taskId);
    const availableTags = tags.filter((t) => !(taskTagMap[taskId] || []).includes(t.id));

    return (
      <div className="space-y-2">
        {/* Current tags on this task */}
        {taskTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {taskTags.map((tag) => (
              <TagPill key={tag.id} tag={tag} onRemove={() => toggleTagOnTask(taskId, tag.id)} />
            ))}
          </div>
        )}

        {/* Available tags to add */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {availableTags.map((tag) => (
              <TagPill key={tag.id} tag={tag} onClick={() => toggleTagOnTask(taskId, tag.id)} />
            ))}
          </div>
        )}

        {/* Create new tag */}
        {showTagCreator === taskId ? (
          <div className="space-y-1.5 rounded-lg border bg-background p-2">
            <div className="flex gap-1.5">
              <input
                autoFocus
                value={newTagEmoji}
                onChange={(e) => setNewTagEmoji(e.target.value)}
                placeholder="😊"
                className="w-10 rounded border bg-card px-1.5 py-1 text-center text-xs focus:outline-none focus:ring-2 focus:ring-ring/20"
                maxLength={2}
              />
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                onKeyDown={(e) => { if (e.key === "Enter") createTag(taskId); }}
                className="flex-1 rounded border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="flex items-center gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewTagColor(c)}
                  className={`h-4 w-4 rounded-full transition-transform ${newTagColor === c ? "scale-125 ring-2 ring-offset-1 ring-offset-background" : "hover:scale-110"}`}
                  style={{ backgroundColor: c, ...(newTagColor === c ? { outlineColor: c } : {}) }}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => createTag(taskId)} disabled={!newTagName.trim()} className="rounded bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-40">
                Create
              </button>
              <button onClick={() => setShowTagCreator(null)} className="rounded px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setShowTagCreator(taskId); setNewTagName(""); setNewTagEmoji(""); setNewTagColor(TAG_COLORS[0]); }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Tag className="h-3 w-3" /> New tag
          </button>
        )}
      </div>
    );
  };

  const renderSubtask = (task: Task, dragHandleProps?: any) => (
    <div className="group rounded-md transition-colors hover:bg-muted/40">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-muted-foreground transition-colors">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <button onClick={() => toggleTask(task.id)} className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${task.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-transparent hover:border-primary hover:text-primary"}`} aria-label={task.done ? "Undo" : "Complete"}>
          <Check className="h-2.5 w-2.5" />
        </button>
        {editingSubtaskId === task.id ? (
          <input autoFocus value={editingSubtaskText} onChange={(e) => setEditingSubtaskText(e.target.value)} onBlur={() => saveSubtaskTitle(task.id)} onKeyDown={(e) => { if (e.key === "Enter") saveSubtaskTitle(task.id); }} className="flex-1 rounded border bg-card px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20" />
        ) : (
          <span onClick={() => { setEditingSubtaskId(task.id); setEditingSubtaskText(task.text); }} className={`flex-1 text-xs cursor-text select-none ${task.done ? "line-through text-muted-foreground" : ""}`}>{task.text}</span>
        )}
        <button onClick={() => removeTask(task.id)} className="flex h-5 w-5 items-center justify-center rounded text-transparent transition-colors group-hover:text-muted-foreground/50 hover:!text-destructive" aria-label="Remove">
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
    const taskTags = getTaskTags(task.id);
    const hasContent = !!task.body || hasSubtasks || taskTags.length > 0;

    return (
      <div className={`rounded-xl border transition-all ${isExpanded ? "border-border/60 bg-card shadow-sm" : "border-transparent hover:border-border/30 hover:bg-muted/30"}`}>
        <div className="group flex items-center gap-2 px-3 py-2.5">
          {isDraggable ? (
            <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-muted-foreground transition-colors">
              <GripVertical className="h-4 w-4" />
            </div>
          ) : <div className="w-5" />}

          <button onClick={() => toggleTask(task.id)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${task.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-transparent hover:border-primary hover:text-primary hover:scale-110"}`} aria-label={task.done ? "Undo" : "Complete"}>
            <Check className="h-3 w-3" />
          </button>

          {(hasContent || isExpanded) ? (
            <button onClick={() => toggleExpanded(task.id)} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-all">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
            </button>
          ) : <div className="w-5" />}

          <div className="flex-1 min-w-0 cursor-default" onClick={() => { if (hasContent && !isExpanded) toggleExpanded(task.id); }}>
            <span className={`text-sm transition-colors ${task.done ? "line-through text-muted-foreground" : ""}`}>{task.text}</span>
            {/* Inline tag pills (collapsed view) */}
            {!isExpanded && taskTags.length > 0 && (
              <span className="ml-1.5 inline-flex gap-1 align-middle">
                {taskTags.map((tag) => (
                  <span key={tag.id} className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-medium" style={{ backgroundColor: tag.color + "18", color: tag.color }}>
                    {tag.emoji && <span className="text-[8px]">{tag.emoji}</span>}
                    {tag.name}
                  </span>
                ))}
              </span>
            )}
            {hasSubtasks && !isExpanded && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {subtasks.filter((s) => s.done).length}/{subtasks.length}
              </span>
            )}
          </div>

          <button onClick={() => isEditing ? saveEdit() : startEdit(task)} className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${isEditing ? "bg-primary/10 text-primary" : "text-transparent group-hover:text-muted-foreground hover:!text-primary hover:!bg-primary/5"}`} aria-label={isEditing ? "Save" : "Edit"}>
            {isEditing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3 w-3" />}
          </button>
          <button onClick={() => removeTask(task.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-transparent transition-all group-hover:text-muted-foreground/50 hover:!text-destructive hover:!bg-destructive/5" aria-label="Remove">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {isExpanded && (
          <div className="px-3 pb-3 pl-[3.25rem] space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
            {isEditing ? (
              <div className="space-y-2">
                <input autoFocus value={editForm.text} onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } }} placeholder="Title" className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow" />
                <textarea value={editForm.body} onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))} placeholder="Notes / details (optional)" rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 resize-y transition-shadow" />

                {/* Tags editor */}
                {!task.parent_id && renderTagEditor(task.id)}

                {/* Add subtask */}
                {!task.parent_id && (
                  <div className="pt-1">
                    {subtaskInputId === task.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); addSubtask(task.id); }} className="flex gap-2">
                        <input autoFocus value={subtaskInput} onChange={(e) => setSubtaskInput(e.target.value)} placeholder="Subtask title..." className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" onKeyDown={(e) => { if (e.key === "Escape") setSubtaskInputId(null); }} />
                        <button type="submit" className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 transition-colors">Add</button>
                      </form>
                    ) : (
                      <button onClick={() => { setSubtaskInputId(task.id); setSubtaskInput(""); }} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        <Plus className="h-3 w-3" /> Add subtask
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={saveEdit} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Save</button>
                  <button onClick={cancelEdit} className="rounded-lg px-4 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {/* Tags display */}
                {taskTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {taskTags.map((tag) => <TagPill key={tag.id} tag={tag} />)}
                  </div>
                )}
                {task.body && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed rounded-lg bg-muted/30 px-3 py-2">{task.body}</p>
                )}
              </>
            )}

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

  // Filtering
  const matchesFilter = (task: Task) => {
    if (!activeFilterTag) return true;
    return (taskTagMap[task.id] || []).includes(activeFilterTag);
  };

  const pendingTop = topLevel.filter((t) => !t.done && matchesFilter(t)).sort((a, b) => a.position - b.position);
  const completedTop = topLevel.filter((t) => t.done && matchesFilter(t)).sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => { e.preventDefault(); addTask(); }} className="flex gap-2">
        <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add a new task..." className="flex-1 rounded-xl border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow" />
        <button type="submit" disabled={!input.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100" aria-label="Add task">
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {/* Subtle tag filter — only shown when tags exist */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <Filter className="h-3 w-3 shrink-0 text-muted-foreground/40" />
          <button
            onClick={() => setActiveFilterTag(null)}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              !activeFilterTag ? "bg-foreground/10 text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setActiveFilterTag(activeFilterTag === tag.id ? null : tag.id)}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all ${
                activeFilterTag === tag.id ? "ring-1 ring-offset-1 ring-offset-background" : "opacity-60 hover:opacity-100"
              }`}
              style={{
                backgroundColor: tag.color + (activeFilterTag === tag.id ? "30" : "15"),
                color: tag.color,
              }}
            >
              {tag.emoji && <span className="mr-0.5">{tag.emoji}</span>}
              {tag.name}
            </button>
          ))}
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-0.5">
          {pendingTop.length === 0 && completedTop.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {activeFilterTag ? "No tasks with this tag." : "No tasks yet — type above to get started."}
            </p>
          )}

          <Droppable droppableId="pending">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-0.5">
                {pendingTop.map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} className={`transition-shadow ${snapshot.isDragging ? "opacity-90 shadow-lg rounded-xl" : ""}`}>
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
                <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest">Completed · {completedTop.length}</span>
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
