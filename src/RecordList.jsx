import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl, remove } from "aws-amplify/storage";
import IconButton from '@mui/material/IconButton'
import ReactMarkdown from "react-markdown";
import SpokeOutlinedIcon from '@mui/icons-material/SpokeOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import AddCircleIcon from '@mui/icons-material/AddCircleOutlined';
import RecordForm from "./RecordForm";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import { getTemplateIcon } from "./utils/iconUtils";
import { parseGrouping } from "./utils/groupingUtils";
Amplify.configure(outputs);

const client = generateClient();

export default function RecordList({ searchItem, templateFilter, showForm, onSelectProjectGroup }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [collapsedTopics, setCollapsedTopics] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const groupRecordsByGrouping = (records) => {
    const grouped = {};

    records.forEach(record => {
      const { project, group } = parseGrouping(record.grouping);
      const topic = project || 'Uncategorized';
      const groupName = group || 'Uncategorized';

      if (!grouped[topic]) {
        grouped[topic] = {};
      }

      if (!grouped[topic][groupName]) {
        grouped[topic][groupName] = [];
      }

      grouped[topic][groupName].push(record);
    });
    return grouped;
  };

  const groupRecordsByToDo = (records) => {
    const grouped = {};

    records.forEach(record => {
      const { project, group } = parseGrouping(record.grouping);
      const topic = project || "* " + record.status;
      const groupName = group || 'Uncategorized';

      if (!grouped[topic]) {
        grouped[topic] = {};
      }

      if (!grouped[topic][groupName]) {
        grouped[topic][groupName] = [];
      }

      grouped[topic][groupName].push(record);
    });
    return grouped;
  };

  const toggleTopic = (topicName) => {
    setCollapsedTopics(prev => {
      const isCurrentlyCollapsed = prev[topicName];

      // If clicking on an already open topic, close it
      if (!isCurrentlyCollapsed) {
        return {
          ...prev,
          [topicName]: true
        };
      }

      // When expanding a topic, set the project context for the form
      if (onSelectProjectGroup) {
        if (templateFilter?.toLowerCase() === 'project') {
          onSelectProjectGroup(topicName === 'Uncategorized' ? '' : topicName, '');
        } else if (templateFilter?.toLowerCase() === 'todo') {
          // For todo view, only set project if topicName is not a status grouping
          const isStatusGrouping = topicName.startsWith('* ');
          const project = isStatusGrouping ? '' : (topicName === 'Uncategorized' ? '' : topicName);
          onSelectProjectGroup(project, '');
        }
      }

      // Otherwise, close all topics and open only this one
      const allCollapsed = {};
      Object.keys(prev).forEach(key => {
        allCollapsed[key] = true;
      });

      return {
        ...allCollapsed,
        [topicName]: false
      };
    });
  };

  const toggleGroup = (topicName, groupName, allGroupNamesInTopic) => {
    const key = `${topicName}::${groupName}`;
    setCollapsedGroups(prev => {
      const isCurrentlyCollapsed = prev[key] ?? true;

      // If clicking on an already open group, close it
      if (!isCurrentlyCollapsed) {
        return {
          ...prev,
          [key]: true
        };
      }

      // Otherwise, close all groups in this topic and open only this one
      const updates = {};
      allGroupNamesInTopic.forEach(gName => {
        const gKey = `${topicName}::${gName}`;
        updates[gKey] = true; // Close all groups
      });
      updates[key] = false; // Open the clicked group

      // When expanding a group, set the project/group context for the form
      if (onSelectProjectGroup) {
        if (templateFilter?.toLowerCase() === 'project') {
          onSelectProjectGroup(topicName === 'Uncategorized' ? '' : topicName, groupName === 'Uncategorized' ? '' : groupName);
        } else if (templateFilter?.toLowerCase() === 'todo') {
          // For todo view, topicName could be "* Open" (status grouping) or an actual project name
          // If it starts with "* ", it's a status grouping, so no project
          // Otherwise, it's an actual project name
          const isStatusGrouping = topicName.startsWith('* ');
          const project = isStatusGrouping ? '' : (topicName === 'Uncategorized' ? '' : topicName);
          const group = groupName === 'Uncategorized' ? '' : groupName;
          onSelectProjectGroup(project, group);
        }
      }

      return {
        ...prev,
        ...updates
      };
    });
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
          items = items.filter((record) => {
            const { project } = parseGrouping(record.grouping);
            return project !== null;
          });
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

    // Collapse all topics by default when project or todo filter is active
    if (templateFilter?.toLowerCase() === 'project' || templateFilter?.toLowerCase() === 'todo') {
      const groupedData = (templateFilter?.toLowerCase() === 'project' ?
        groupRecordsByGrouping(items) :
        groupRecordsByToDo(items)
      );
      const topicNames = Object.keys(groupedData);

      const collapsed = {};
      topicNames.forEach(topicName => {
        collapsed[topicName] = true;
      });

      setCollapsedTopics(collapsed);
    }
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
      className={selectedId === r.id ? "record-card-selected" : "record-card"}
    >
      {selectedId === r.id ? (
        editingRecord?.id === r.id ? (
          <RecordForm templateFilter={templateFilter} editRecord={editingRecord} onCancelEdit={cancelEdit} />
        ) : (
          <> {/* Select */}
            <div className="record-header gap-8">
              <div className="record-title-wrapper">
                {getTemplateIcon(r.template, "1.2em")}
                <strong className="record-title word-break">{r.title}</strong>
              </div>
              <div className="record-actions">
                <IconButton aria-label="close" onClick={() => { setSelectedId(null); }} >
                  <CloseOutlinedIcon />
                </IconButton>
              </div>
            </div>
            <div className="record-meta">
              {r.template && <>{r.template} · </>}
              {r.grouping && <>{r.grouping}</>}
              {r.status && <> ({r.status}) </>}
            </div>
            {r.imageUrl && (
              <img src={r.imageUrl} alt={r.title ? `Image for ${r.title}` : 'Record image'} className="image-full" />
            )}
            {r.notes && (
              <div className="record-notes">
              <ReactMarkdown>{r.notes}</ReactMarkdown>
              </div>
            )}
            <div className="record-footer">
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
          <div className="record-header gap-8">
            <div className="record-title-wrapper">
              {getTemplateIcon(r.template, "1.2em")}
              <strong className="record-title word-break">{r.title}</strong>
            </div>
            <div className="record-actions">
              <IconButton aria-label="select" onClick={() => selectId(r)}>
                <SpokeOutlinedIcon />
              </IconButton>
            </div>
          </div>
          <div className="record-meta-compact">
            {r.template && <>{r.template} · </>}
            {r.grouping && <>{r.grouping}</>}
            {r.status && <> ({r.status}) </>}
          </div>
          <div className="record-content-flex">
            {r.imageUrl && (
              <img src={r.imageUrl} alt={r.title ? `Image for ${r.title}` : 'Record image'} className="image-thumbnail" />
            )}
              {r.notes && <div className="record-notes-preview">{r.notes}</div>}
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
            collapsedGroups[`${topicName}::${groupName}`] ?? true
          );

          return (
            <div key={topicName} className="topic-container">
              {/* Topic Header */}
              <div className="topic-header">
                  
                <span
                  onClick={() => toggleTopic(topicName)}
                  className="cursor-pointer flex-1"
                >
                  {topicName} ({topicCount})
                </span>
                  {!isTopicCollapsed  && (
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

              {/* Groups within Topic */}
              {!isTopicCollapsed && groupNames.map(groupName => {
                const groupRecords = topicGroups[groupName];
                const groupKey = `${topicName}::${groupName}`;
                const isGroupCollapsed = collapsedGroups[groupKey] ?? true;

                return (
                  <div key={groupKey} className="topic-content">
                    {/* Group Header */}
                    <div
                      onClick={() => toggleGroup(topicName, groupName, groupNames)}
                      className="group-header"
                    >
                      <span className="cursor-pointer flex-1">{groupName} ({groupRecords.length})</span>
                      {isGroupCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                    </div>

                    {/* Records within Group */}
                    {!isGroupCollapsed && (
                      <div className="group-content">
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
