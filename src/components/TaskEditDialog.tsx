import { useState, useEffect, useCallback } from "react";
import { X, Plus, Tag, Check, GripVertical, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

interface TaskEditDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  tags: TagType[];
  taskTagMap: Record<string, string[]>;
  onTasksChange: (tasks: Task[]) => void;
  onTagsChange: (tags: TagType[]) => void;
  onTaskTagMapChange: (map: Record<string, string[]>) => void;
  onTaskDeleted: (id: string) => void;
}

const TaskEditDialog = ({
  task,
  open,
  onOpenChange,
  tasks,
  tags,
  taskTagMap,
  onTasksChange,
  onTagsChange,
  onTaskTagMapChange,
  onTaskDeleted,
}: TaskEditDialogProps) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subtaskInput, setSubtaskInput] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskText, setEditingSubtaskText] = useState("");
  const [showTagCreator, setShowTagCreator] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagEmoji, setNewTagEmoji] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (task && open) {
      setTitle(task.text);
      setBody(task.body || "");
      setShowSubtaskInput(false);
      setSubtaskInput("");
      setEditingSubtaskId(null);
      setShowTagCreator(false);
      setConfirmDelete(false);
    }
  }, [task?.id, open]);

  if (!task) return null;

  const subtasks = tasks
    .filter((t) => t.parent_id === task.id)
    .sort((a, b) => a.position - b.position);

  const taskTags = (taskTagMap[task.id] || [])
    .map((tid) => tags.find((t) => t.id === tid))
    .filter(Boolean) as TagType[];

  const availableTags = tags.filter((t) => !(taskTagMap[task.id] || []).includes(t.id));

  const saveTitle = async (newTitle: string) => {
    const text = newTitle.trim() || "Untitled";
    setTitle(text);
    onTasksChange(tasks.map((t) => (t.id === task.id ? { ...t, text } : t)));
    await supabase.from("tasks").update({ text }).eq("id", task.id);
  };

  const saveBody = async (newBody: string) => {
    const bodyVal = newBody.trim() || null;
    setBody(newBody);
    onTasksChange(tasks.map((t) => (t.id === task.id ? { ...t, body: bodyVal } : t)));
    await supabase.from("tasks").update({ body: bodyVal }).eq("id", task.id);
  };

  const addSubtask = async () => {
    const text = subtaskInput.trim();
    if (!text || !user) return;
    const id = crypto.randomUUID();
    const position = subtasks.length;
    const newTask: Task = { id, text, body: null, done: false, position, parent_id: task.id };
    onTasksChange([...tasks, newTask]);
    setSubtaskInput("");
    await supabase.from("tasks").insert({ id, user_id: user.id, text, done: false, position, parent_id: task.id } as any);
  };

  const removeSubtask = async (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const saveSubtaskTitle = async (id: string) => {
    const text = editingSubtaskText.trim() || "Untitled";
    onTasksChange(tasks.map((t) => (t.id === id ? { ...t, text } : t)));
    setEditingSubtaskId(null);
    await supabase.from("tasks").update({ text }).eq("id", id);
  };

  const reorderSubtasks = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    const reordered = [...subtasks];
    const [removed] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, removed);
    const updated = reordered.map((t, i) => ({ ...t, position: i }));
    const ids = new Set(updated.map((u) => u.id));
    onTasksChange([...tasks.filter((t) => !ids.has(t.id)), ...updated]);
    await Promise.all(updated.filter((t, i) => subtasks[i]?.id !== t.id).map((t) => supabase.from("tasks").update({ position: t.position }).eq("id", t.id)));
  };

  const toggleTagOnTask = async (tagId: string) => {
    const current = taskTagMap[task.id] || [];
    if (current.includes(tagId)) {
      onTaskTagMapChange({ ...taskTagMap, [task.id]: current.filter((id) => id !== tagId) });
      await supabase.from("task_tags").delete().eq("task_id", task.id).eq("tag_id", tagId);
    } else {
      onTaskTagMapChange({ ...taskTagMap, [task.id]: [...current, tagId] });
      await supabase.from("task_tags").insert({ task_id: task.id, tag_id: tagId } as any);
    }
  };

  const createTag = async () => {
    if (!user || !newTagName.trim()) return;
    const existingTag = tags.find((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase());
    if (existingTag) {
      await toggleTagOnTask(existingTag.id);
      setNewTagName("");
      setShowTagCreator(false);
      return;
    }
    const id = crypto.randomUUID();
    const tag: TagType = { id, name: newTagName.trim(), color: newTagColor, emoji: newTagEmoji.trim() || null };
    onTagsChange([...tags, tag]);
    await supabase.from("tags").insert({ id, user_id: user.id, name: tag.name, color: tag.color, emoji: tag.emoji } as any);
    await toggleTagOnTask(id);
    setNewTagName("");
    setNewTagEmoji("");
    setShowTagCreator(false);
  };

  const deleteTask = async () => {
    onTaskDeleted(task.id);
    await supabase.from("tasks").delete().eq("id", task.id);
    onOpenChange(false);
  };

  const handleOpenChange = async (newOpen: boolean) => {
    if (!newOpen && task) {
      // Auto-save title and body on close
      const trimmedTitle = title.trim() || "Untitled";
      const trimmedBody = body.trim() || null;
      if (trimmedTitle !== task.text) {
        onTasksChange(tasks.map((t) => (t.id === task.id ? { ...t, text: trimmedTitle } : t)));
        await supabase.from("tasks").update({ text: trimmedTitle }).eq("id", task.id);
      }
      if (trimmedBody !== task.body) {
        onTasksChange(tasks.map((t) => (t.id === task.id ? { ...t, body: trimmedBody } : t)));
        await supabase.from("tasks").update({ body: trimmedBody }).eq("id", task.id);
      }
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Edit Task</DialogTitle>
          <DialogDescription className="sr-only">Edit task details, subtasks, and tags</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => saveTitle(title)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveTitle(title); (e.target as HTMLInputElement).blur(); } }}
              className="w-full rounded-lg border bg-card px-3 py-2.5 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => saveBody(body)}
              placeholder="Add details or notes..."
              rows={5}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 resize-y transition-shadow"
            />
          </div>

          {/* Tags */}
          {!task.parent_id && (
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> Tags
              </label>

              {/* Current tags */}
              {taskTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {taskTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: tag.color + "20", color: tag.color }}
                      onClick={() => toggleTagOnTask(tag.id)}
                    >
                      {tag.emoji && <span>{tag.emoji}</span>}
                      {tag.name}
                      <X className="h-2.5 w-2.5 ml-0.5" />
                    </span>
                  ))}
                </div>
              )}

              {/* Available tags */}
              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {availableTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: tag.color + "15", color: tag.color }}
                      onClick={() => toggleTagOnTask(tag.id)}
                    >
                      {tag.emoji && <span className="text-[10px]">{tag.emoji}</span>}
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Create new tag */}
              {showTagCreator ? (
                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5">
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
                      onKeyDown={(e) => { if (e.key === "Enter") createTag(); }}
                      className="flex-1 rounded border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewTagColor(c)}
                        className={`h-4 w-4 rounded-full transition-transform ${newTagColor === c ? "scale-125 ring-2 ring-offset-1 ring-offset-background" : "hover:scale-110"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={createTag} disabled={!newTagName.trim()} className="rounded bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-40">Create</button>
                    <button onClick={() => setShowTagCreator(false)} className="rounded px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setShowTagCreator(true); setNewTagName(""); setNewTagEmoji(""); setNewTagColor(TAG_COLORS[0]); }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Plus className="h-3 w-3" /> New tag
                </button>
              )}
            </div>
          )}

          {/* Subtasks */}
          {!task.parent_id && (
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Subtasks</label>

              <DragDropContext onDragEnd={reorderSubtasks}>
                <Droppable droppableId="dialog-subtasks">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0.5">
                      {subtasks.map((sub, index) => (
                        <Draggable key={sub.id} draggableId={sub.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all ${snapshot.isDragging ? "shadow-md bg-card" : "hover:bg-muted/40"}`}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
                                <GripVertical className="h-3.5 w-3.5" />
                              </div>
                              <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[10px] ${sub.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-transparent"}`}>
                                <Check className="h-2.5 w-2.5" />
                              </span>
                              {editingSubtaskId === sub.id ? (
                                <input
                                  autoFocus
                                  value={editingSubtaskText}
                                  onChange={(e) => setEditingSubtaskText(e.target.value)}
                                  onBlur={() => saveSubtaskTitle(sub.id)}
                                  onKeyDown={(e) => { if (e.key === "Enter") saveSubtaskTitle(sub.id); if (e.key === "Escape") setEditingSubtaskId(null); }}
                                  className="flex-1 rounded border bg-card px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20"
                                />
                              ) : (
                                <span
                                  onClick={() => { setEditingSubtaskId(sub.id); setEditingSubtaskText(sub.text); }}
                                  className={`flex-1 text-xs cursor-text select-none ${sub.done ? "line-through text-muted-foreground" : ""}`}
                                >
                                  {sub.text}
                                </span>
                              )}
                              <button
                                onClick={() => removeSubtask(sub.id)}
                                className="flex h-5 w-5 items-center justify-center rounded text-transparent group-hover:text-muted-foreground/50 hover:!text-destructive transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {subtasks.length === 0 && !showSubtaskInput && (
                <p className="text-xs text-muted-foreground/50 px-1">No subtasks yet.</p>
              )}

              {showSubtaskInput ? (
                <form onSubmit={(e) => { e.preventDefault(); addSubtask(); }} className="flex gap-2">
                  <input
                    autoFocus
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    placeholder="Subtask title..."
                    className="flex-1 rounded-lg border bg-card px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                    onKeyDown={(e) => { if (e.key === "Escape") setShowSubtaskInput(false); }}
                  />
                  <button type="submit" className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 transition-colors">Add</button>
                </form>
              ) : (
                <button
                  onClick={() => { setShowSubtaskInput(true); setSubtaskInput(""); }}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add subtask
                </button>
              )}
            </div>
          )}

          {/* Delete section */}
          <div className="border-t pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive">Delete this task and all its subtasks?</span>
                <button onClick={deleteTask} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors">Delete</button>
                <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Delete task
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskEditDialog;
