import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl, uploadData, remove } from "aws-amplify/storage";
import ReactMarkdown from "react-markdown";
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ListIcon from '@mui/icons-material/List';
import CollectionsIcon from '@mui/icons-material/Collections';

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

export default function RecordList({ searchItem, setSearchItem, templateFilter }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [newImageFile, setNewImageFile] = useState(null);
  const [draft, setDraft] = useState({});

  const [filteredRecords, setFilteredRecords] = useState([]);

  const getTemplateIcon = (template) => {
    if (!template) return null;
    const templateLower = template.toLowerCase();

    switch (templateLower) {
      case 'todo':
        return <PlaylistAddCheckIcon style={{ fontSize: "1.2em", marginRight: 6 }} />;
      case 'project':
        return <AccountTreeIcon style={{ fontSize: "1.2em", marginRight: 6 }} />;
      case 'tracker':
        return <StackedLineChartIcon style={{ fontSize: "1.2em", marginRight: 6 }} />;
      case 'diary':
        return <AutoStoriesIcon style={{ fontSize: "1.2em", marginRight: 6 }} />;
      case 'list':
        return <ListIcon style={{ fontSize: "1.2em", marginRight: 6 }} />;
      case 'collection':
        return <CollectionsIcon style={{ fontSize: "1.2em", marginRight: 6 }} />;
      default:
        return null;
    }
  };

  const searchChange = (e) => {
    setSearchItem(e.target.value);
  };

  async function load() {
    setLoading(true);
    const { data } = await client.models.Record.list({ limit: 500 })
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
    let items = records;

    if (searchItem) {
      const term = searchItem.toLowerCase();
      items = items.filter((record) => (record.title ?? "").toLowerCase().includes(term));
    }

    if (templateFilter) {
      const tf = templateFilter.toLowerCase();
      switch (tf) {
        case "project":
          items = items.filter((record) => 
            (record.template ?? "").toLowerCase() !== "collection" && 
            (record.grouping ?? "").includes("[") &&
            (record.grouping ?? "").includes("]")
          );
          break;
        default:
          items = items.filter((record) => 
            (record.template ?? "").toLowerCase().includes(tf)
          );
          break;
      }
    }

    setFilteredRecords(items);
  }, [records, searchItem, templateFilter]);

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

                <div style={{ display: "flex", justifyContent: "flex-start", gap: 8 }}>
                {r.imageUrl && (
                  <img src={r.imageUrl} alt="" style={{ maxHeight: "2.5em", marginTop: 8 }} />
                )}
                  <div style={{ display: "grid", fontSize: 12, color: "#555", margin: 6 }}>
                    Replace image (optional)
                  
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewImageFile(e.target.files?.[0] ?? null)}
                  />
                  </div>
                  {newImageFile ? (
                    <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
                      New image selected: {newImageFile.name}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => saveEdit(r)}>Save</button>
                  <button onClick={() => { setEditingId(null); 
                    setNewImageFile(null); }}>Cancel</button>

                </div>
              </>
            ) : (
              <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {getTemplateIcon(r.template)}
                      <strong>{r.title}</strong>
                    </div>
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
                    <img src={r.imageUrl} alt="" style={{ display: "block", margin: "auto", maxWidth: "80%"}} />
                  )}

                  {r.notes && (
                    <div style={{ marginTop: 8, whiteSpace: "pre-wrap"}}>
                    <ReactMarkdown>{r.notes}</ReactMarkdown>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end"}}>
                    <button onClick={() => deleteRecord(r)}>Delete</button>
                    <button onClick={() => startEdit(r)}>Edit</button>
                  </div>
              </>
            )
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {getTemplateIcon(r.template)}
                  <strong>{r.title}</strong>
                </div>
                <div style={{ display: "flex", gap: 6, maxHeight: "1.5em" }}>
                  <button onClick={() => selectId(r)}>Select</button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#555", margin: 3 }}>
                {r.template && <>{r.template} · </>}
                {r.grouping && <>{r.grouping}</>}
                {r.status && <> ({r.status}) </>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-start", gap: 8 }}>
                {r.imageUrl && (
                  <img src={r.imageUrl} alt="" style={{ maxHeight: "5em" }} />
                )}
            
                  {r.notes && <div style={{ maxHeight: "5em", overflow: "auto" }}>{r.notes}</div>}
                
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
