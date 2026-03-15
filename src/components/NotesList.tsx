import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, ChevronRight, GripVertical, Pencil, Filter } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import NoteEditDialog from "@/components/NoteEditDialog";

interface Note {
  id: string;
  title: string;
  body: string | null;
  position: number;
}

interface TagType {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

const NotesList = ({ reloadRef, expanded }: { reloadRef?: React.MutableRefObject<(() => void) | null>; expanded?: boolean }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<TagType[]>([]);
  const [noteTagMap, setNoteTagMap] = useState<Record<string, string[]>>({});
  const [input, setInput] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeFilterTag, setActiveFilterTag] = useState<string | null>(null);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const editDialogOpenRef = useRef(false);
  const deletedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadNotes = useCallback(async () => {
    if (!user) return;
    const [{ data: noteData }, { data: tagData }, { data: ntData }] = await Promise.all([
      supabase.from("notes").select("id, title, body, position").eq("user_id", user.id).order("position", { ascending: true }),
      supabase.from("tags").select("id, name, color, emoji").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("note_tags").select("note_id, tag_id"),
    ]);
    if (noteData) setNotes(noteData as Note[]);
    if (tagData) setTags(tagData as TagType[]);
    if (ntData) {
      const map: Record<string, string[]> = {};
      for (const row of ntData) {
        if (!map[row.note_id]) map[row.note_id] = [];
        map[row.note_id].push(row.tag_id);
      }
      setNoteTagMap(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    if (reloadRef) {
      reloadRef.current = () => {
        if (!editDialogOpenRef.current) loadNotes();
      };
    }
  }, [reloadRef, loadNotes]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getNoteTags = (noteId: string) =>
    (noteTagMap[noteId] || []).map((tid) => tags.find((t) => t.id === tid)).filter(Boolean) as TagType[];

  const addNote = async () => {
    const value = input.trim();
    if (!value || !user) return;
    const id = crypto.randomUUID();
    const position = notes.length;
    const newNote: Note = { id, title: value, body: null, position };
    setNotes((prev) => [...prev, newNote]);
    setInput("");
    inputRef.current?.focus();
    await supabase.from("notes").insert({ id, user_id: user.id, title: value, position } as any);
    // Auto-open edit dialog for the new note
    setEditNote(newNote);
    setEditDialogOpen(true);
    editDialogOpenRef.current = true;
  };

  const handleNoteDeleted = (id: string) => {
    deletedRef.current = true;
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const reorder = async (list: Note[], startIndex: number, endIndex: number) => {
    const result = [...list];
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    const updated = result.map((n, i) => ({ ...n, position: i }));
    setNotes((prev) => {
      const ids = new Set(updated.map((u) => u.id));
      return [...prev.filter((n) => !ids.has(n.id)), ...updated];
    });
    await Promise.all(
      updated.filter((n, i) => list[i]?.id !== n.id).map((n) =>
        supabase.from("notes").update({ position: n.position } as any).eq("id", n.id)
      )
    );
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    const filtered = notes
      .filter((n) => matchesFilter(n))
      .sort((a, b) => a.position - b.position);
    reorder(filtered, source.index, destination.index);
  };

  const matchesFilter = (note: Note) => {
    if (!activeFilterTag) return true;
    return (noteTagMap[note.id] || []).includes(activeFilterTag);
  };

  const sortedNotes = notes.filter(matchesFilter).sort((a, b) => a.position - b.position);

  const renderNoteContent = (note: Note, isDraggable: boolean, dragHandleProps?: any) => {
    const isExpanded = expandedIds.has(note.id);
    const noteTags = getNoteTags(note.id);
    const hasBody = !!note.body;
    const hasContent = hasBody || noteTags.length > 0;

    return (
      <div
        className={`rounded-xl border transition-all ${
          isExpanded
            ? "border-border/60 bg-card shadow-sm"
            : "border-transparent hover:border-border/30 hover:bg-muted/30"
        }`}
      >
        {/* Note row */}
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

          {hasContent ? (
            <button onClick={() => toggleExpanded(note.id)} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-all">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div
            className="flex-1 min-w-0 cursor-default"
            onClick={() => { if (hasContent && !isExpanded) toggleExpanded(note.id); }}
          >
            <span className="text-sm">{note.title}</span>
            {!isExpanded && noteTags.length > 0 && (
              <span className="ml-1.5 inline-flex gap-1 align-middle">
                {noteTags.map((tag) => (
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
          </div>

          <button
            onClick={() => { setEditNote(note); setEditDialogOpen(true); }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-transparent transition-all group-hover:text-muted-foreground hover:!text-primary hover:!bg-primary/5"
            aria-label="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>

        {/* Expanded content — show 2 lines preview */}
        {isExpanded && (
          <div className="px-3 pb-3 pl-[3.25rem] space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
            {noteTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {noteTags.map((tag) => (
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

            {hasBody && (
              <p
                className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed rounded-lg bg-muted/30 px-3 py-2 line-clamp-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => { setEditNote(note); setEditDialogOpen(true); }}
                title="Click to view full note"
              >
                {note.body}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col gap-4 ${expanded ? "mx-auto w-full max-w-3xl" : ""}`}>
      <form onSubmit={(e) => { e.preventDefault(); addNote(); }} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a new note..."
          className="flex-1 rounded-xl border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          aria-label="Add note"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {/* Tag filter */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
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
          {loading ? (
            <div className="py-10 flex flex-col items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading notes...</p>
            </div>
          ) : sortedNotes.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {activeFilterTag ? "No notes with this tag." : "No notes yet — type above to get started."}
            </p>
          )}

          <Droppable droppableId="notes">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-0.5">
                {sortedNotes.map((note, index) => (
                  <Draggable key={note.id} draggableId={note.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`transition-shadow ${snapshot.isDragging ? "opacity-90 shadow-lg rounded-xl" : ""}`}
                      >
                        {renderNoteContent(note, true, provided.dragHandleProps)}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </DragDropContext>

      <NoteEditDialog
        note={editNote ? notes.find((n) => n.id === editNote.id) || editNote : null}
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          editDialogOpenRef.current = open;
          if (!open) {
            setEditNote(null);
            loadNotes();
          }
        }}
        tags={tags}
        noteTagMap={noteTagMap}
        onNotesChange={setNotes}
        onTagsChange={setTags}
        onNoteTagMapChange={setNoteTagMap}
        onNoteDeleted={handleNoteDeleted}
      />
    </div>
  );
};

export default NotesList;
