import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Check, ChevronRight, GripVertical, Pencil, Filter } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TaskEditDialog from "@/components/TaskEditDialog";

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

const TodoList = ({ reloadRef }: { reloadRef?: React.MutableRefObject<(() => void) | null> }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [taskTagMap, setTaskTagMap] = useState<Record<string, string[]>>({});
  const [input, setInput] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const editDialogOpenRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Expose reload function to parent (guarded by edit dialog state)
  useEffect(() => {
    if (reloadRef) {
      reloadRef.current = () => {
        if (!editDialogOpenRef.current) {
          loadTasks();
        }
      };
    }
  }, [reloadRef, loadTasks]);

  // Helpers
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getSubtasks = (parentId: string) =>
    tasks.filter((t) => t.parent_id === parentId).sort((a, b) => a.position - b.position);

  const topLevel = tasks.filter((t) => !t.parent_id);

  const getTaskTags = (taskId: string) =>
    (taskTagMap[taskId] || []).map((tid) => tags.find((t) => t.id === tid)).filter(Boolean) as TagType[];

  // Task operations
  const addTask = async () => {
    const value = input.trim();
    if (!value || !user) return;
    const id = crypto.randomUUID();
    const position = topLevel.length;
    const newTask: Task = { id, text: value, body: null, done: false, position, parent_id: null };
    setTasks((prev) => [...prev, newTask]);
    setInput("");
    inputRef.current?.focus();
    await supabase.from("tasks").insert({ id, user_id: user.id, text: value, done: false, position, parent_id: null } as any);
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newDone = !task.done;
    const subtaskIds = task.parent_id ? [] : getSubtasks(id).map((s) => s.id);
    setTasks((prev) =>
      prev.map((t) => t.id === id || subtaskIds.includes(t.id) ? { ...t, done: newDone } : t)
    );
    await supabase.from("tasks").update({ done: newDone }).eq("id", id);
    if (subtaskIds.length > 0)
      await Promise.all(subtaskIds.map((sid) => supabase.from("tasks").update({ done: newDone }).eq("id", sid)));
  };

  const handleTaskDeleted = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parent_id !== id));
    setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
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
      updated.filter((t, i) => list[i]?.id !== t.id).map((t) =>
        supabase.from("tasks").update({ position: t.position }).eq("id", t.id)
      )
    );
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index && source.droppableId === destination.droppableId) return;
    if (source.droppableId === "pending") {
      const pending = topLevel.filter((t) => !t.done).sort((a, b) => a.position - b.position);
      reorder(pending, source.index, destination.index);
    }
  };

  const openEditDialog = (task: Task) => {
    setEditTask(task);
    setEditDialogOpen(true);
  };

  // Filtering
  const matchesFilter = (task: Task) => {
    if (!activeFilterTag) return true;
    return (taskTagMap[task.id] || []).includes(activeFilterTag);
  };

  const pendingTop = topLevel.filter((t) => !t.done && matchesFilter(t)).sort((a, b) => a.position - b.position);
  const completedTop = topLevel.filter((t) => t.done && matchesFilter(t)).sort((a, b) => a.position - b.position);

  const renderSubtaskRow = (sub: Task) => (
    <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
      <button
        onClick={() => toggleTask(sub.id)}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
          sub.done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 text-transparent hover:border-primary hover:text-primary"
        }`}
      >
        <Check className="h-2.5 w-2.5" />
      </button>
      <span className={`flex-1 text-xs ${sub.done ? "line-through text-muted-foreground" : ""}`}>
        {sub.text}
      </span>
    </div>
  );

  const renderTaskContent = (task: Task, isDraggable: boolean, dragHandleProps?: any) => {
    const isExpanded = expandedIds.has(task.id);
    const subtasks = getSubtasks(task.id);
    const hasSubtasks = subtasks.length > 0;
    const taskTags = getTaskTags(task.id);
    const hasContent = !!task.body || hasSubtasks || taskTags.length > 0;

    return (
      <div
        className={`rounded-xl border transition-all ${
          isExpanded
            ? "border-border/60 bg-card shadow-sm"
            : "border-transparent hover:border-border/30 hover:bg-muted/30"
        }`}
      >
        {/* Task row */}
        <div className="group flex items-center gap-2 px-3 py-2.5">
          {isDraggable ? (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-muted-foreground transition-colors"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          ) : (
            <div className="w-5" />
          )}

          <button
            onClick={() => toggleTask(task.id)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
              task.done
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/30 text-transparent hover:border-primary hover:text-primary hover:scale-110"
            }`}
          >
            <Check className="h-3 w-3" />
          </button>

          {hasContent ? (
            <button onClick={() => toggleExpanded(task.id)} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-all">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div
            className="flex-1 min-w-0 cursor-default"
            onClick={() => { if (hasContent && !isExpanded) toggleExpanded(task.id); }}
          >
            <span className={`text-sm transition-colors ${task.done ? "line-through text-muted-foreground" : ""}`}>
              {task.text}
            </span>
            {/* Inline tag pills (collapsed view) */}
            {!isExpanded && taskTags.length > 0 && (
              <span className="ml-1.5 inline-flex gap-1 align-middle">
                {taskTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-medium"
                    style={{ backgroundColor: tag.color + "18", color: tag.color }}
                  >
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

          <button
            onClick={() => openEditDialog(task)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-transparent transition-all group-hover:text-muted-foreground hover:!text-primary hover:!bg-primary/5"
            aria-label="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>

        {/* Expanded content (read-only) */}
        {isExpanded && (
          <div className="px-3 pb-3 pl-[3.25rem] space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Tags */}
            {taskTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {taskTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: tag.color + "20", color: tag.color }}
                  >
                    {tag.emoji && <span className="text-[10px]">{tag.emoji}</span>}
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Body / notes */}
            {task.body && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed rounded-lg bg-muted/30 px-3 py-2">
                {task.body}
              </p>
            )}

            {/* Subtasks (check only — no drag, no edit, no delete) */}
            {hasSubtasks && (
              <div className="space-y-0.5 pt-1">
                {subtasks.map((sub) => renderSubtaskRow(sub))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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

      {/* Tag filter */}
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

      {/* Edit dialog */}
      <TaskEditDialog
        task={editTask ? tasks.find(t => t.id === editTask.id) || editTask : null}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditTask(null);
        }}
        tasks={tasks}
        tags={tags}
        taskTagMap={taskTagMap}
        onTasksChange={setTasks}
        onTagsChange={setTags}
        onTaskTagMapChange={setTaskTagMap}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
};

export default TodoList;
