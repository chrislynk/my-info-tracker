import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl, remove } from "aws-amplify/storage";
import IconButton from '@mui/material/IconButton'
import ReactMarkdown from "react-markdown";
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ListIcon from '@mui/icons-material/List';
import CollectionsIcon from '@mui/icons-material/Collections';
import SpokeOutlinedIcon from '@mui/icons-material/SpokeOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import RecordForm from "./RecordForm";

const client = generateClient();

export default function RecordList({ searchItem, setSearchItem, templateFilter }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);

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
    setEditingRecord(r);
    setSelectedId(r.id);
  }

  function cancelEdit() {
    setEditingRecord(null);
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
    <div>
      <input
        type="text"
        value={searchItem}
        onChange={searchChange}
        placeholder='Type to search'
        style={{ padding: 10, fontSize: "16px", width: "-webkit-fill-available", marginBottom: 12 }}
      />
      {filteredRecords.map((r) => (
        <div
          key={r.id}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
        >
          {selectedId === r.id ? (
            editingRecord?.id === r.id ? (
              <RecordForm
                templateFilter={templateFilter}
                editRecord={editingRecord}
                onCancelEdit={cancelEdit}
              />
            ) : (
              <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", flex: "1 1 auto", minWidth: 0 }}>
                      {getTemplateIcon(r.template)}
                      <strong style={{ fontSize: "16px", wordBreak: "break-word" }}>{r.title}</strong>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <IconButton aria-label="close" onClick={() => { setSelectedId(null); }} >
                        <CloseOutlinedIcon />
                      </IconButton>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 8 }}>
                    {r.template && <>{r.template} · </>}
                    {r.grouping && <>{r.grouping}</>}
                    {r.status && <> ({r.status}) </>}
                  </div>
                  {r.imageUrl && (
                    <img src={r.imageUrl} alt="" style={{ display: "block", margin: "8px auto", maxWidth: "100%", height: "auto"}} />
                  )}

                  {r.notes && (
                    <div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: "14px"}}>
                    <ReactMarkdown>{r.notes}</ReactMarkdown>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6, justifyContent: "space-between", flexWrap: "wrap", marginTop: 8 }}>
                    
                    <IconButton aria-label="select" onClick={() => deleteRecord(r)}>
                      <DeleteForeverOutlinedIcon />
                    </IconButton>
                    <IconButton aria-label="select" onClick={() => startEdit(r)}>
                      <BorderColorOutlinedIcon />
                    </IconButton>
                  </div>
              </>
            )
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", flex: "1 1 auto", minWidth: 0 }}>
                  {getTemplateIcon(r.template)}
                  <strong style={{ fontSize: "16px", wordBreak: "break-word" }}>{r.title}</strong>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <IconButton aria-label="select" onClick={() => selectId(r)}>
                    <SpokeOutlinedIcon />
                  </IconButton>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#555", margin: 3 }}>
                {r.template && <>{r.template} · </>}
                {r.grouping && <>{r.grouping}</>}
                {r.status && <> ({r.status}) </>}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
                {r.imageUrl && (
                  <img src={r.imageUrl} alt="" style={{ maxHeight: "5em", maxWidth: "100%", height: "auto" }} />
                )}

                  {r.notes && <div style={{ maxHeight: "5em", overflow: "auto", flex: "1 1 auto", fontSize: "14px" }}>{r.notes}</div>}

              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
