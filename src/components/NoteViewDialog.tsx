import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import LinkifiedText from "@/components/LinkifiedText";

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

interface NoteViewDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: TagType[];
  noteTagMap: Record<string, string[]>;
  onEdit: () => void;
}

const NoteViewDialog = ({ note, open, onOpenChange, tags, noteTagMap, onEdit }: NoteViewDialogProps) => {
  if (!note) return null;

  const noteTags = (noteTagMap[note.id] || [])
    .map((tid) => tags.find((t) => t.id === tid))
    .filter(Boolean) as TagType[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold pr-8">{note.title}</DialogTitle>
          <DialogDescription className="sr-only">View note content</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tags */}
          {noteTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {noteTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                >
                  {tag.emoji && <span>{tag.emoji}</span>}
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Body */}
          {note.body ? (
            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed rounded-lg bg-muted/30 px-4 py-3 min-h-[6rem]">
              {note.body}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic py-4 text-center">No content yet.</p>
          )}

          {/* Edit button */}
          <div className="flex justify-end">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Pencil className="h-3 w-3" /> Edit note
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NoteViewDialog;
