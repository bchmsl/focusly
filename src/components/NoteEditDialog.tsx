import { useState, useEffect } from "react";
import { X, Plus, Tag, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

const TAG_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#64748b",
];

interface NoteEditDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: TagType[];
  noteTagMap: Record<string, string[]>;
  onNotesChange: React.Dispatch<React.SetStateAction<Note[]>>;
  onTagsChange: (tags: TagType[]) => void;
  onNoteTagMapChange: (map: Record<string, string[]>) => void;
  onNoteDeleted: (id: string) => void;
}

const NoteEditDialog = ({
  note,
  open,
  onOpenChange,
  tags,
  noteTagMap,
  onNotesChange,
  onTagsChange,
  onNoteTagMapChange,
  onNoteDeleted,
}: NoteEditDialogProps) => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showTagCreator, setShowTagCreator] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagEmoji, setNewTagEmoji] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (note && open) {
      setTitle(note.title);
      setBody(note.body || "");
      setShowTagCreator(false);
      setConfirmDelete(false);
    }
  }, [note, open]);

  if (!note) return null;

  const noteTags = (noteTagMap[note.id] || [])
    .map((tid) => tags.find((t) => t.id === tid))
    .filter(Boolean) as TagType[];

  const availableTags = tags.filter((t) => !(noteTagMap[note.id] || []).includes(t.id));

  const saveTitle = async (newTitle: string) => {
    const text = newTitle.trim() || "Untitled";
    setTitle(text);
    onNotesChange((prev) => prev.map((n) => (n.id === note.id ? { ...n, title: text } : n)));
    await supabase.from("notes").update({ title: text } as any).eq("id", note.id);
  };

  const saveBody = async (newBody: string) => {
    const bodyVal = newBody.trim() || null;
    setBody(newBody);
    onNotesChange((prev) => prev.map((n) => (n.id === note.id ? { ...n, body: bodyVal } : n)));
    await supabase.from("notes").update({ body: bodyVal } as any).eq("id", note.id);
  };

  const toggleTagOnNote = async (tagId: string) => {
    const current = noteTagMap[note.id] || [];
    if (current.includes(tagId)) {
      onNoteTagMapChange({ ...noteTagMap, [note.id]: current.filter((id) => id !== tagId) });
      await supabase.from("note_tags").delete().eq("note_id", note.id).eq("tag_id", tagId);
    } else {
      onNoteTagMapChange({ ...noteTagMap, [note.id]: [...current, tagId] });
      await supabase.from("note_tags").insert({ note_id: note.id, tag_id: tagId } as any);
    }
  };

  const createTag = async () => {
    if (!user || !newTagName.trim()) return;
    const existingTag = tags.find((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase());
    if (existingTag) {
      await toggleTagOnNote(existingTag.id);
      setNewTagName("");
      setShowTagCreator(false);
      return;
    }
    const id = crypto.randomUUID();
    const tag: TagType = { id, name: newTagName.trim(), color: newTagColor, emoji: newTagEmoji.trim() || null };
    onTagsChange([...tags, tag]);
    await supabase.from("tags").insert({ id, user_id: user.id, name: tag.name, color: tag.color, emoji: tag.emoji } as any);
    await toggleTagOnNote(id);
    setNewTagName("");
    setNewTagEmoji("");
    setShowTagCreator(false);
  };

  const deleteNote = async () => {
    onNoteDeleted(note.id);
    onOpenChange(false);
    await supabase.from("notes").delete().eq("id", note.id);
  };

  const handleOpenChange = async (newOpen: boolean) => {
    if (!newOpen && note) {
      const trimmedTitle = title.trim() || "Untitled";
      const trimmedBody = body.trim() || null;
      if (trimmedTitle !== note.title) {
        onNotesChange((prev) => prev.map((n) => (n.id === note.id ? { ...n, title: trimmedTitle } : n)));
        await supabase.from("notes").update({ title: trimmedTitle } as any).eq("id", note.id);
      }
      if (trimmedBody !== note.body) {
        onNotesChange((prev) => prev.map((n) => (n.id === note.id ? { ...n, body: trimmedBody } : n)));
        await supabase.from("notes").update({ body: trimmedBody } as any).eq("id", note.id);
      }
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Edit Note</DialogTitle>
          <DialogDescription className="sr-only">Edit note details and tags</DialogDescription>
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
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Content</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={() => saveBody(body)}
              placeholder="Write your note..."
              rows={8}
              className="w-full rounded-lg border bg-card px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 resize-y transition-shadow"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Tags
            </label>

            {noteTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {noteTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: tag.color + "20", color: tag.color }}
                    onClick={() => toggleTagOnNote(tag.id)}
                  >
                    {tag.emoji && <span>{tag.emoji}</span>}
                    {tag.name}
                    <X className="h-2.5 w-2.5 ml-0.5" />
                  </span>
                ))}
              </div>
            )}

            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: tag.color + "15", color: tag.color }}
                    onClick={() => toggleTagOnNote(tag.id)}
                  >
                    {tag.emoji && <span className="text-[10px]">{tag.emoji}</span>}
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

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

          {/* Delete */}
          <div className="border-t pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive">Delete this note?</span>
                <button onClick={deleteNote} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors">Delete</button>
                <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Delete note
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NoteEditDialog;
