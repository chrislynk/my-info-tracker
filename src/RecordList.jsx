import { useCallback, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl, remove } from "aws-amplify/storage";
import { listAllRelationships } from "./utils/recordRelationships";
import IconButton from '@mui/material/IconButton';
import ReactMarkdown from "react-markdown";
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import RecordForm from "./RecordForm";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import { getTemplateIcon } from "./utils/iconUtils";
import { parseGrouping } from "./utils/groupingUtils";

import { toReadableDate } from "./utils/dateUtils";

Amplify.configure(outputs);

const client = generateClient();

const groupRecords = (records, createTopic) => {
  const grouped = {};

  records.forEach(record => {
    const { project, group } = parseGrouping(record.grouping);
    const { topic, groupName } = createTopic(record, project, group);

    grouped[topic] ??= {};
    grouped[topic][groupName] ??= [];
    grouped[topic][groupName].push(record);
  });

  return grouped;
};

export default function RecordList({ searchItem, templateFilter, onSelectProjectGroup }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [collapsedTopics, setCollapsedTopics] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [relationships, setRelationships] = useState([]);

  const templateByTopic = useMemo(() => {
    return records.reduce((map, record) => {
      const { project } = parseGrouping(record.grouping);
      if (project && record.template === "Collection") {
        map[project] = record.template;
      }
      return map;
    }, {});
  }, [records]);

  const filteredRecords = useMemo(() => {
    let items = records;

    const search = searchItem?.trim().toLowerCase();
    if (search) {
      items = items.filter(record => (record.title ?? "").toLowerCase().includes(search));
    }

    if (!templateFilter) {
      return items;
    }

    if (templateFilter === "Project") {
      return items.filter(record => parseGrouping(record.grouping).project !== null);
    }

    if (templateFilter === "ToDo") {
      return items.filter(record =>
        (record.template ?? "") === "ToDo" &&
        (record.status === "Open" || record.status === "In Progress")
      );
    }

    return items.filter(record => (record.template ?? "").includes(templateFilter));
  }, [records, searchItem, templateFilter]);

  const groupedRecords = useMemo(() => {

    if (!templateFilter) return null;
    
    switch (templateFilter) {
      case "Project":
        return groupRecords(filteredRecords, (record, project, group) => ({
          topic: project || "Uncategorized",
          groupName: group || "Uncategorized",
        }));
      case "ToDo":
        return groupRecords(filteredRecords, (record, project, group) => ({
          topic: project || `* ${record.status}`,
          groupName: group || "Uncategorized",
        }));
      case "Tracker":
        return groupRecords(filteredRecords, (record, project, group) => ({
          topic: group || "Uncategorized",
          groupName: toReadableDate(record.start) + ': ' + record.title,
        }));
      default:
        return groupRecords(filteredRecords, (record, project) => ({
          topic: record.start?record.start.split('T')[0]:'' || "Uncategorized",
          groupName: project?project:record.title || "Uncategorized",
        }));
    }

  }, [filteredRecords, templateFilter]);

  useEffect(() => {
    if (!groupedRecords) return;

    const nextCollapsedTopics = Object.keys(groupedRecords).reduce((acc, topicName) => {
        acc[topicName] = false;
        return acc;
      }, {});

    const nextCollapsedGroups = Object.entries(groupedRecords).reduce((acc, [topicName, groups]) => {
      Object.keys(groups).forEach(groupName => {
        acc[`${topicName}::${groupName}`] = true;
      });
      return acc;
    }, {});

    setCollapsedTopics(nextCollapsedTopics);
    setCollapsedGroups(nextCollapsedGroups);
  }, [groupedRecords]);

  const loadRelationships = async () => {
    const data = await listAllRelationships();
    setRelationships(data);
  };

  const load = useCallback(async () => {
    setLoading(true);

    await client.models.RecordRelationship.list();
    const { data } = await client.models.Record.list({ limit: 500 });
    const sortedData = (data ?? []).sort((a, b) => new Date(b.start) - new Date(a.start));

    const withUrls = await Promise.all(sortedData.map(async (record) => {
      if (!record.imageKey) return record;
      try {
        const { url } = await getUrl({ path: record.imageKey });
        return { ...record, imageUrl: url.toString() };
      } catch {
        return record;
      }
    }));

    setRecords(withUrls);
    setLoading(false);
  }, []);

  const recordTitleById = useMemo(() => {
    return records.reduce((map, record) => {
      map[record.id] = record.title;
      return map;
    }, {});
  }, [records]);

  useEffect(() => {
    load();
    loadRelationships();
    window.addEventListener("records:changed", load);
    return () => window.removeEventListener("records:changed", load);
  }, [load]);

  const toggleTopic = (topicName) => {
    const isCollapsed = collapsedTopics[topicName] ?? true;

    if (!isCollapsed) {
      setCollapsedTopics(prev => ({ ...prev, [topicName]: true }));
      return;
    }

    const allCollapsed = Object.keys(collapsedTopics).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});

    setCollapsedTopics({ ...allCollapsed, [topicName]: false });

    if (onSelectProjectGroup) {
      onSelectProjectGroup(
        topicName.startsWith("* ") ? "" : topicName,
        "",
        templateFilter === "ToDo" ? "ToDo" : templateByTopic[topicName]
      );
    }
  };

  const toggleGroup = (topicName, groupName, allGroupNamesInTopic) => {
    const key = `${topicName}::${groupName}`;
    const isCollapsed = collapsedGroups[key] ?? true;

    if (!isCollapsed) {
      setCollapsedGroups(prev => ({ ...prev, [key]: true }));
      return;
    }

    const updates = allGroupNamesInTopic.reduce((acc, gName) => {
      acc[`${topicName}::${gName}`] = true;
      return acc;
    }, {});

    updates[key] = false;
    setCollapsedGroups(prev => ({ ...prev, ...updates }));

    if (onSelectProjectGroup) {
      if (templateFilter === "Project") {
        onSelectProjectGroup(
          topicName === "Uncategorized" ? "" : topicName,
          groupName === "Uncategorized" ? "" : groupName,
          templateByTopic[topicName]
        );
      } else if (templateFilter === "ToDo") {
        const project = topicName.startsWith("* ") ? "" : (topicName === "Uncategorized" ? "" : topicName);
        const group = groupName === "Uncategorized" ? "" : groupName;
        onSelectProjectGroup(project, group, templateFilter);
      }
    }
  };

  const toggleAllGroupsInTopic = (topicName, groupNames, shouldCollapse) => {
    const updates = groupNames.reduce((acc, groupName) => {
      acc[`${topicName}::${groupName}`] = shouldCollapse;
      return acc;
    }, {});

    setCollapsedGroups(prev => ({ ...prev, ...updates }));
  };

  const selectId = (record) => setSelectedId(record.id);
  const startEdit = (record) => {
    setEditingRecord(record);
    setSelectedId(record.id);
  };
  const cancelEdit = () => setEditingRecord(null);

  const deleteRecord = async (record) => {
    const ok = window.confirm(`Delete "${record.title}"? This cannot be undone.`);
    if (!ok) return;

    try {
      if (record.imageKey) {
        await remove({ path: record.imageKey });
      }

      await client.models.Record.delete({ id: record.id });
      load();
    } catch (err) {
      console.error(err);
      alert(`Delete failed: ${err?.message ?? err}`);
    }
  };

  if (loading) return <div>Loading…</div>;
  if (!records.length) return <div>No records yet.</div>;

  const renderRecord = (record, isGrouped = false) => (
    <div
      key={record.id}
      className={selectedId === record.id ? "record-card-selected" : "record-card"}
    >
      {selectedId === record.id ? (
        editingRecord?.id === record.id ? (
          <RecordForm editRecord={editingRecord} records={records} onCancelEdit={cancelEdit} loadRelationships={loadRelationships} />
        ) : (
          <>
            <div className="record-header gap-8">
              <div className="record-title-wrapper">
                {getTemplateIcon(record.template, "1.2em")}
                <strong className="record-title word-break">
                  {!isGrouped && record.grouping ? `${record.grouping}: ${record.title}` : record.title}
                </strong>
              </div>
              <div className="record-actions">
                <IconButton aria-label="close" onClick={() => setSelectedId(null)}>
                  <CloseOutlinedIcon />
                </IconButton>
              </div>
            </div>

            <div className="record-meta">
              <div>
              {record.start && <> {new Date(record.start).toLocaleDateString()} · </>}
              {record.template && <> {record.template} · </>}
              {record.grouping && <> {record.grouping}</>}
              {record.status && <> ({record.status}) </>}
              </div>
              <div>
                {relationships.filter(rel => rel.sourceRecordId === record.id).map(rel => (
                  <span key={rel.id} className="relationship-tag">
                    {rel.type} → {recordTitleById[rel.targetRecordId] ?? rel.targetRecordId}
                  </span>
                ))}
              </div>
            </div>

            {record.imageUrl && (
              <img
                src={record.imageUrl}
                alt={record.title ? `Image for ${record.title}` : "Record image"}
                className="image-full"
              />
            )}

            {record.notes && (
              <div className="record-notes">
                <ReactMarkdown>{record.notes}</ReactMarkdown>
              </div>
            )}

            <div className="record-footer">
              <IconButton aria-label="delete" onClick={() => deleteRecord(record)}>
                <DeleteForeverOutlinedIcon />
              </IconButton>
              <IconButton aria-label="edit" onClick={() => startEdit(record)}>
                <BorderColorOutlinedIcon />
              </IconButton>
            </div>
          </>
        )
      ) : (
        <>
          <div className="record-header gap-8" onClick={() => selectId(record)}>
            <div className="record-title-wrapper">
              {getTemplateIcon(record.template, "1.2em")}
              <strong className="record-title word-break">
                {!isGrouped && record.grouping ? `${record.grouping}: ${record.title}` : record.title}
              </strong>
            </div>
            <div className="record-actions">
              <IconButton aria-label="select" onClick={() => selectId(record)}>
                <MoreHorizIcon />
              </IconButton>
            </div>
          </div>

          <div className="record-meta-compact">
            <div>
              {record.start && (
                <> {new Date(record.start).toLocaleDateString("en-US", { month: "short", day: "2-digit" })} · </>
              )}
              {record.template && <>{record.template} · </>}
              {record.grouping && <>{record.grouping}</>}
              {record.status && <> ({record.status}) </>}
            </div>
            <div>
              {relationships.filter(rel => rel.sourceRecordId === record.id).map(rel => (
                <span key={rel.id} className="relationship-tag">
                  {rel.type} → {recordTitleById[rel.targetRecordId] ?? rel.targetRecordId}
                </span>
              ))}
            </div>
          </div>

          <div className="record-content-flex">
            {record.imageUrl && (
              <img
                src={record.imageUrl}
                alt={record.title ? `Image for ${record.title}` : "Record image"}
                className="image-thumbnail"
              />
            )}
            {record.notes && <div className="record-notes-preview">{record.notes}</div>}
          </div>
        </>
      )}
    </div>
  );

  if (templateFilter) {
    const topicNames = templateFilter === "Diary"
      ? Object.keys(groupedRecords).sort().reverse()
      : Object.keys(groupedRecords).sort();

    return (
      <div>
        {topicNames.map(topicName => {
          const topicGroups = groupedRecords[topicName];
          const groupNames = Object.keys(topicGroups).sort();

          const topicCount = groupNames.reduce((sum, groupName) => sum + topicGroups[groupName].length, 0);
          const isTopicCollapsed = collapsedTopics[topicName];
          const allGroupsCollapsed = groupNames.every(groupName => collapsedGroups[`${topicName}::${groupName}`] ?? true);

          return (
            <div key={topicName} className="topic-container">
              <div className="topic-header">
                <span onClick={() => toggleTopic(topicName)} className="cursor-pointer flex-1">
                  {topicName} {topicCount>1?(<span className="record-count">({topicCount})</span>):null}
                </span>
                {!isTopicCollapsed && (
                  <IconButton
                    onClick={e => {
                      e.stopPropagation();
                      toggleAllGroupsInTopic(topicName, groupNames, !allGroupsCollapsed);
                    }}
                    title={allGroupsCollapsed ? "Expand all groups" : "Collapse all groups"}
                    sx={{
                      color: "white",
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      padding: "8px",
                      "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.9)" },
                    }}
                  >
                    {allGroupsCollapsed ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
                  </IconButton>
                )}
              </div>

              {!isTopicCollapsed &&
                groupNames.map(groupName => {
                  const groupRecordsForTopic = topicGroups[groupName];
                  const groupKey = `${topicName}::${groupName}`;
                  const isGroupCollapsed = collapsedGroups[groupKey] ?? true;

                  return (
                    <div key={groupKey} className="topic-content">
                      <div onClick={() => toggleGroup(topicName, groupName, groupNames)} className="group-header">
                        <span className="cursor-pointer flex-1">
                          {groupName} {groupRecordsForTopic.length>1?(<span className="record-count">({groupRecordsForTopic.length})</span>):null}
                        </span>
                        {isGroupCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                      </div>
                      {!isGroupCollapsed && (
                        <div className="group-content">
                          {groupRecordsForTopic.map(record => renderRecord(record, true))}
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

  return <div>{filteredRecords.map(record => renderRecord(record))}</div>;
}