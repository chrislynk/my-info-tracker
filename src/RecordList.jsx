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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import RecordForm from "./RecordForm";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
Amplify.configure(outputs);

const client = generateClient();

export default function RecordList({ searchItem, templateFilter }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [collapsedTopics, setCollapsedTopics] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});

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

  const getTopic = (grouping) => {
    if (!grouping) return null;
    const match = grouping.match(/\[(.*?)\]/);
    return match ? match[1].trim() : null;
  }

  const getGroup = (grouping) => {
    if (!grouping) return null;
    const match = grouping.match(/\](.*)/);
    if(!match) return grouping.trim();
    return match ? match[1].trim() : grouping.trim();
  }

  const groupRecordsByGrouping = (records) => {
    const grouped = {};

    records.forEach(record => {
      const { topic, group } = { 
        topic: getTopic(record.grouping) || 'Uncategorized', 
        group: getGroup(record.grouping) || 'Uncategorized' 
      };

      if (!grouped[topic]) {
        grouped[topic] = {};
      }

      if (!grouped[topic][group]) {
        grouped[topic][group] = [];
      }

      grouped[topic][group].push(record);
    });
    return grouped;
  };

  const groupRecordsByToDo = (records) => {
    const grouped = {};

    records.forEach(record => {
      const { topic, group } = { 
        topic: getTopic(record.grouping) || "* " + record.status, 
        group: getGroup(record.grouping) || 'Uncategorized' 
      };

      if (!grouped[topic]) {
        grouped[topic] = {};
      }

      if (!grouped[topic][group]) {
        grouped[topic][group] = [];
      }

      grouped[topic][group].push(record);
    });
    return grouped;
  };

  const toggleTopic = (topicName) => {
    setCollapsedTopics(prev => ({
      ...prev,
      [topicName]: !prev[topicName]
    }));
  };

  const toggleGroup = (topicName, groupName) => {
    const key = `${topicName}::${groupName}`;
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleAllGroupsInTopic = (topicName, groupNames, shouldCollapse) => {
    const updates = {};
    groupNames.forEach(groupName => {
      const key = `${topicName}::${groupName}`;
      updates[key] = shouldCollapse;
    });
    setCollapsedGroups(prev => ({
      ...prev,
      ...updates
    }));
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
             getTopic(record.grouping) !== null
          );
          break;
        case "todo":
          items = items.filter((record) => 
            (record.template ?? "").toLowerCase() === "todo" && 
            (record.status === "Open" || record.status === "In Progress")
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

  const renderRecord = (r) => (
    <div
      key={r.id}
      style={selectedId === r.id ?
        {border: "1px solid #1E96C8", borderRadius: 8, padding: 12, marginBottom: 12, boxShadow: "rgba(30, 150, 200, 0.25) 5px 5px 5px 2px"} :
        {border: "1px solid #1E96C8", borderRadius: 8, padding: 12, marginBottom: 12}
      }
    >
      {selectedId === r.id ? (
        editingRecord?.id === r.id ? (
          <RecordForm templateFilter={templateFilter} editRecord={editingRecord} onCancelEdit={cancelEdit} />
        ) : (
          <> {/* Select */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8}}>
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
            <div style={{ display: "flex", gap: 6, justifyContent: "space-between", marginTop: 8 }}>
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
        <> {/* list-itewm */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8}}>
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
          <div style={{ display: "flex", justifyContent: "flex-start", gap: 8 }}>
            {r.imageUrl && (
              <img src={r.imageUrl} alt="" style={{ maxHeight: "5em", maxWidth: "100%", height: "auto" }} />
            )}
              {r.notes && <div style={{ maxHeight: "5em", overflow: "auto", flex: "1 1 auto", fontSize: "14px" }}>{r.notes}</div>}
          </div>
        </>
      )}
    </div>
  );

  // Render grouped view for project template filter
  if (templateFilter?.toLowerCase() === 'project' ||
      templateFilter?.toLowerCase() === 'todo') {
    const groupedData = (templateFilter?.toLowerCase() === 'project' ? 
      groupRecordsByGrouping(filteredRecords) : 
      groupRecordsByToDo(filteredRecords)
    );
    const topicNames = Object.keys(groupedData).sort();

    return (
      <div>
        {topicNames.map(topicName => {
          const topicGroups = groupedData[topicName];
          const groupNames = Object.keys(topicGroups).sort();
          const topicCount = groupNames.reduce((sum, groupName) => sum + topicGroups[groupName].length, 0);
          const isTopicCollapsed = collapsedTopics[topicName];

          const allGroupsCollapsed = groupNames.every(groupName =>
            collapsedGroups[`${topicName}::${groupName}`] === true
          );

          return (
            <div key={topicName} style={{ marginBottom: 16 }}>
              {/* Topic Header */}
              <div
                style={{
                  backgroundColor: '#1E96C8',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  marginBottom: 8
                }}
              >
                <span
                  onClick={() => toggleTopic(topicName)}
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  {topicName} ({topicCount})
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {!isTopicCollapsed && (
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllGroupsInTopic(topicName, groupNames, !allGroupsCollapsed);
                      }}
                      title={allGroupsCollapsed ? 'Expand all groups' : 'Collapse all groups'}
                      sx={{
                        color: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        padding: '8px',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.9)'
                        }
                      }}
                    >
                      {allGroupsCollapsed ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
                    </IconButton>
                  )}
                </div>
              </div>

              {/* Groups within Topic */}
              {!isTopicCollapsed && groupNames.map(groupName => {
                const groupRecords = topicGroups[groupName];
                const groupKey = `${topicName}::${groupName}`;
                const isGroupCollapsed = collapsedGroups[groupKey];

                return (
                  <div key={groupKey} style={{ marginLeft: 16, marginBottom: 12 }}>
                    {/* Group Header */}
                    <div
                      onClick={() => toggleGroup(topicName, groupName)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: '#E3F2FD',
                        color: '#1565C0',
                        padding: '10px 14px',
                        borderRadius: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontWeight: '600',
                        fontSize: '16px',
                        marginBottom: 8
                      }}
                    >
                      <span>{groupName} ({groupRecords.length})</span>
                      {isGroupCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                    </div>

                    {/* Records within Group */}
                    {!isGroupCollapsed && (
                      <div style={{ marginLeft: 16 }}>
                        {groupRecords.map(r => renderRecord(r))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // Default flat list view
  return (
    <div>
      {filteredRecords.map((r) => renderRecord(r))}
    </div>
  );
}
