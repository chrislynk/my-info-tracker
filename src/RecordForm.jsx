import { useMemo, useState } from "react";
import { uploadData } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";

const client = generateClient();

function toIsoOrNull(datetimeLocalValue) {
  // datetime-local returns "YYYY-MM-DDTHH:mm"
  if (!datetimeLocalValue) return null;
  const d = new Date(datetimeLocalValue);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function RecordForm() {
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(""); // datetime-local
  const [end, setEnd] = useState(""); // datetime-local
  const [notes, setNotes] = useState("");
  const [tagsText, setTagsText] = useState(""); // comma-separated
  const [entryKind, setEntryKind] = useState("");
  const [status, setStatus] = useState("");
  const [collection, setCollection] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const tags = useMemo(() => {
    const arr = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return arr.length ? arr : null;
  }, [tagsText]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      // 1) upload image (optional)
      let imageKey = null;
      if (imageFile) {
        imageKey = `public/${crypto.randomUUID()}-${imageFile.name}`;
        await uploadData({
          path: imageKey,
          data: imageFile,
          options: { contentType: imageFile.type },
        }).result;
      }

      // 2) create record
      const payload = {
        title: title.trim(),
        start: toIsoOrNull(start),
        end: toIsoOrNull(end),
        notes: notes.trim() ? notes.trim() : null,
        tags,
        template: entryKind.trim() ? entryKind.trim() : null,
        status: status.trim() ? status.trim() : null,
        grouping: collection.trim() ? collection.trim() : null,
        imageKey,
      };

      const { data, errors } = await client.models.Record.create(payload);
      if (errors?.length) throw new Error(errors.map((x) => x.message).join("; "));
      if (!data?.id) throw new Error("Create failed: no record returned.");

      // 3) reset form
      setTitle("");
      setStart("");
      setEnd("");
      setNotes("");
      setTagsText("");
      setEntryKind("");
      setStatus("");
      setCollection("");
      setImageFile(null);

      // 4) let the list know to refresh
      window.dispatchEvent(new Event("records:changed"));
    } catch (err) {
      console.error(err);
      alert(`Save failed: ${err?.message ?? err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontWeight: 600 }}>Title *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Gym session"
          required
          style={{ padding: 10 }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 600 }}>Start</label>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={{ padding: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 600 }}>End</label>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={{ padding: 10 }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontWeight: 600 }}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
          rows={4}
          style={{ padding: 10, resize: "vertical" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 600 }}>Tags (comma-separated)</label>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="e.g., health, cardio, personal"
            style={{ padding: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 600 }}>Entry Kind</label>
          <input
            value={entryKind}
            onChange={(e) => setEntryKind(e.target.value)}
            placeholder="e.g., workout, note, task"
            style={{ padding: 10 }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 600 }}>Status</label>
          <input
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="e.g., active, done, cancelled"
            style={{ padding: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 600 }}>Collection</label>
          <input
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            placeholder="e.g., 2026, fitness, work"
            style={{ padding: 10 }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontWeight: 600 }}>Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
        />
        {imageFile ? (
          <div style={{ fontSize: 12, color: "#444" }}>
            Selected: {imageFile.name} ({Math.round(imageFile.size / 1024)} KB)
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="submit" disabled={saving} style={{ padding: "10px 14px" }}>
          {saving ? "Saving..." : "Save Record"}
        </button>
      </div>
    </form>
  );
}
