import { useState, type FormEvent } from "react";
import { addNote } from "../api/candidates";
import { errorMessage } from "../api/http";
import type { Note } from "../api/types";
import { formatDateTime } from "../lib/format";

type Props = {
  candidateId: string;
  // As the API returns them: oldest first.
  notes: Note[];
  onNoteAdded: (note: Note) => void;
};

// Notes are append-only: there is an add form and a list, and deliberately no
// edit or delete control anywhere (the API has no such endpoints either).
export function NotesPanel({ candidateId, notes, onNoteAdded }: Props) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onNoteAdded(await addNote(candidateId, draft));
      setDraft("");
    } catch (err) {
      // Keep the draft so nothing typed is lost.
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Newest first, as in the design.
  const newestFirst = [...notes].reverse();

  return (
    <section className="card section-card notes-panel" aria-labelledby="notes-heading">
      <h2 id="notes-heading">Notes</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="note-draft">Add a note</label>
          <textarea
            id="note-draft"
            rows={3}
            maxLength={5_000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-describedby="note-permanent"
          />
        </div>
        {error && (
          <p className="form-field__error" role="alert">
            Couldn't add the note. {error}
          </p>
        )}
        <button type="submit" className="button button--primary notes-panel__submit" disabled={saving || !draft.trim()}>
          {saving ? "Adding…" : "Add note"}
        </button>
        <p id="note-permanent" className="notes-panel__hint">
          Notes are permanent and can't be edited or deleted.
        </p>
      </form>

      {newestFirst.length === 0 ? (
        <p className="notes-panel__empty">No notes yet.</p>
      ) : (
        <ul className="note-list">
          {newestFirst.map((note) => (
            <li key={note.id}>
              <p className="note-list__when">
                <time dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
              </p>
              <p className="note-list__body">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
