import { useState } from "react";
import { Check, GripVertical, Pencil } from "lucide-react";
import LinkifiedText from "@/components/LinkifiedText";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";

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

interface TaskViewDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  tags: TagType[];
  taskTagMap: Record<string, string[]>;
  onTasksChange: (tasks: Task[]) => void;
  onEdit: () => void;
}

const TaskViewDialog = ({
  task,
  open,
  onOpenChange,
  tasks,
  tags,
  taskTagMap,
  onTasksChange,
  onEdit,
}: TaskViewDialogProps) => {
  if (!task) return null;

  const subtasks = tasks
    .filter((t) => t.parent_id === task.id)
    .sort((a, b) => a.position - b.position);

  const taskTags = (taskTagMap[task.id] || [])
    .map((tid) => tags.find((t) => t.id === tid))
    .filter(Boolean) as TagType[];

  const toggleSubtask = async (id: string) => {
    const sub = tasks.find((t) => t.id === id);
    if (!sub) return;
    const newDone = !sub.done;
    onTasksChange(tasks.map((t) => (t.id === id ? { ...t, done: newDone } : t)));
    await supabase.from("tasks").update({ done: newDone }).eq("id", id);
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
    await Promise.all(
      updated
        .filter((t, i) => subtasks[i]?.id !== t.id)
        .map((t) => supabase.from("tasks").update({ position: t.position }).eq("id", t.id))
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold pr-8"><LinkifiedText text={task.text} /></DialogTitle>
          <DialogDescription className="sr-only">View task details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tags */}
          {taskTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {taskTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                >
                  {tag.emoji && <span>{tag.emoji}</span>}
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Body / notes */}
          {task.body ? (
            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed rounded-lg bg-muted/30 px-4 py-3">
              <LinkifiedText text={task.body} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No notes.</p>
          )}

          {/* Subtasks — view-only with reorder + toggle */}
          {subtasks.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Subtasks · {subtasks.filter((s) => s.done).length}/{subtasks.length}
              </label>

              <DragDropContext onDragEnd={reorderSubtasks}>
                <Droppable droppableId="view-subtasks">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0.5">
                      {subtasks.map((sub, index) => (
                        <Draggable key={sub.id} draggableId={sub.id} index={index}>
                          {(prov, snapshot) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={`group flex items-center gap-2 rounded-lg px-2 py-2 transition-all ${snapshot.isDragging ? "shadow-md bg-card" : "hover:bg-muted/40"}`}
                            >
                              <div {...prov.dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <button
                                onClick={() => toggleSubtask(sub.id)}
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                                  sub.done
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground/30 text-transparent hover:border-primary hover:text-primary"
                                }`}
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <span className={`flex-1 text-sm ${sub.done ? "line-through text-muted-foreground" : ""}`}>
                                <LinkifiedText text={sub.text} />
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}

          {/* Edit button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit task
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskViewDialog;
