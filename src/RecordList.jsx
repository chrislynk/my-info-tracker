import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl, uploadData, remove } from "aws-amplify/storage";
import ReactMarkdown from "react-markdown";

const client = generateClient();

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toISOString().slice(0, 16);
}

function toIsoOrNull(local) {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function RecordList() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [newImageFile, setNewImageFile] = useState(null);
  const [draft, setDraft] = useState({});

  const [searchItem, setSearchItem] = useState('');
  const [filteredRecords, setFilteredRecords] = useState(records)
  const searchChange = (e) => {
    const searchTerm = e.target.value;
    setSearchItem(searchTerm)

    const filteredItems =  records.filter((record) => 
      record.title.toLowerCase().includes(searchTerm.toLowerCase()) 
    );
    setFilteredRecords(filteredItems)
  }

  async function load() {
    setLoading(true);
    const { data } = await client.models.Record.list({ limit: 500 })
    setFilteredRecords(data);
    const withUrls = await Promise.all(
      (data ?? []).map(async (r) => {
        if (!r.imageKey) return r;
        try {
          const { url } = await getUrl({ path: r.imageKey });
          return { ...r, imageUrl: url.toString() };
        } catch {
          return r;
        }
      })
    );

    setRecords(withUrls);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("records:changed", handler);
    return () => window.removeEventListener("records:changed", handler);
  }, [ ]);

  function selectId(r) {
    setSelectedId(r.id);
  }

  function startEdit(r) {
    setEditingId(r.id);
    setNewImageFile(null);
    setDraft({
      title: r.title ?? "",
      start: toLocalInputValue(r.start),
      end: toLocalInputValue(r.end),
      notes: r.notes ?? "",
      tags: (r.tags ?? []).join(", "),
      template: r.template ?? "",
      status: r.status ?? "",
      grouping: r.grouping ?? "",
    });
  }

  async function saveEdit(record) {
    // record is the full item (includes imageKey)
    try {
      let id = record.id
      let nextImageKey = record.imageKey ?? null;

      // 1) if user selected a new file, upload it first
      if (newImageFile) {
        const uploadedKey = `public/${crypto.randomUUID()}-${newImageFile.name}`;

        await uploadData({
          path: uploadedKey,
          data: newImageFile,
          options: { contentType: newImageFile.type },
        }).result;

        nextImageKey = uploadedKey;
      }

      // 2) update the record (including imageKey if changed)
      await client.models.Record.update({
        id,
        title: draft.title.trim(),
        start: toIsoOrNull(draft.start),
        end: toIsoOrNull(draft.end),
        notes: draft.notes || null,
        tags: draft.tags
          ? draft.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : null,
        template: draft.template || null,
        status: draft.status || null,
        grouping: draft.grouping || null,
        imageKey: nextImageKey,
      });

      // 3) if we uploaded a new image, delete the old one (after DB update succeeds)
      if (newImageFile && record.imageKey && record.imageKey !== nextImageKey) {
        await remove({ path: record.imageKey });
      }

      setSelectedId(null);
      setEditingId(null);
      setDraft({});
      setNewImageFile(null);
      load();
    } catch (err) {
      console.error(err);
      alert(`Save failed: ${err?.message ?? err}`);
    }
  }

  async function deleteRecord(record) {
    const ok = window.confirm(
      `Delete "${record.title}"? This cannot be undone.`
    );
    if (!ok) return;

    try {
      // 1) delete image from S3 (if any)
      if (record.imageKey) {
        await remove({ path: record.imageKey });
      }

      // 2) delete record from DynamoDB
      await client.models.Record.delete({ id: record.id });

      // 3) refresh list
      load();
    } catch (err) {
      console.error(err);
      alert(`Delete failed: ${err?.message ?? err}`);
    }
  }


  if (loading) return <div>Loading…</div>;
  if (!records.length) return <div>No records yet.</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <input
        type="text"
        value={searchItem}
        onChange={searchChange}
        placeholder='Type to search'
      />
      {filteredRecords.map((r) => (
        <div
          key={r.id}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
        >
          {selectedId === r.id ? (
            editingId === r.id ? (
              <>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  style={{ width: "100%", marginBottom: 8 }}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input
                    type="datetime-local"
                    value={draft.start}
                    onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  />
                  <input
                    type="datetime-local"
                    value={draft.end}
                    onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                  />
                </div>

                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={3}
                  style={{ width: "100%", marginTop: 8 }}
                />

                <input
                  placeholder="tags (comma-separated)"
                  value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                  style={{ width: "100%", marginTop: 8 }}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                  <input
                    placeholder="entry kind"
                    value={draft.template}
                    onChange={(e) => setDraft({ ...draft, template: e.target.value })}
                  />
                  <input
                    placeholder="status"
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  />
                  <input
                    placeholder="Grouping"
                    value={draft.grouping}
                    onChange={(e) => setDraft({ ...draft, grouping: e.target.value })}
                  />
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
                    Replace image (optional)
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewImageFile(e.target.files?.[0] ?? null)}
                  />
                  {newImageFile ? (
                    <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
                      New image selected: {newImageFile.name}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => saveEdit(r)}>Save</button>
                  <button onClick={() => { setEditingId(null); 
                    setNewImageFile(null); }}>Cancel</button>

                </div>
              </>
            ) : (
              <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong>{r.title}</strong>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setSelectedId(null); }}>close</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 8 }}>
                    {r.template && <>{r.template} · </>}
                    {r.grouping && <>{r.grouping}</>}
                    {r.status && <> ({r.status}) </>}
                  </div>
                  {r.imageUrl && (
                    <img src={r.imageUrl} alt="" style={{ display: "block", margin: "auto"}} />
                  )}

                  {r.notes && (
                    <div style={{ marginTop: 8, whiteSpace: "pre-wrap"}}>
                    <ReactMarkdown>{r.notes}</ReactMarkdown>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEdit(r)}>Edit</button>
                    <button onClick={() => deleteRecord(r)}>Delete</button>
                  </div>
                  </div>
              </>
            )
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{r.title}</strong>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => selectId(r)}>Select</button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 8 }}>
                {r.template && <>{r.template} · </>}
                {r.grouping && <>{r.grouping}</>}
                {r.status && <> ({r.status}) </>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-start", gap: 8 }}>
                {r.imageUrl && (
                  <img src={r.imageUrl} alt="" style={{ maxWidth: 100, marginTop: 8 }} />
                )}
                <div>
                  {r.notes && <div style={{ marginTop: 8 }}>{r.notes.slice(0, 120)}</div>}
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
