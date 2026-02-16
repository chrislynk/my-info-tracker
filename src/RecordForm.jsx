import { useEffect, useMemo, useState, useRef } from "react";
import { uploadData, remove } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import ReactMarkdown from "react-markdown";
import { renderToStaticMarkup } from 'react-dom/server';
import Editor from 'react-simple-wysiwyg';
import TurndownService from 'turndown';
import IconButton from '@mui/material/IconButton'
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import { toIsoOrNull, toLocalInputValue } from "./utils/dateUtils";
import { parseGrouping, formatGrouping } from "./utils/groupingUtils";
import { getTemplateIcon } from "./utils/iconUtils";
Amplify.configure(outputs);

const client = generateClient();

export default function RecordForm({ templateFilter, editRecord, onCancelEdit, showForm, setShowForm }) {
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);

  const [noteHtml, setNoteHtml] = useState('');

  const isEditMode = !!editRecord;

  // If templateFilter is "Project", treat it as no filter. Otherwise, use it as a hard-coded template value.
  const effectiveTemplateFilter = templateFilter?.toLowerCase() === 'project' ? null : templateFilter;

  const divRef = useRef(null);

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(""); // datetime-local
  const [end, setEnd] = useState(""); // datetime-local
  const [notes, setNotes] = useState("");
  const [template, setTemplate] = useState("");
  const [status, setStatus] = useState("");
  const [project, setProject] = useState("");
  const [group, setGroup] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const [existingProjects, setExistingProjects] = useState([]);
  const [existingGroups, setExistingGroups] = useState([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newProjectInput, setNewProjectInput] = useState("");
  const [newGroupInput, setNewGroupInput] = useState("");
  const [ungroupedGroups, setUngroupedGroups] = useState([]);

  const [groupsByProject, setGroupsByProject] = useState({});
  const filteredGroups = useMemo(() => {
    const p = project.trim();
    if (!p) return ungroupedGroups; // no project selected => show all
    return (groupsByProject[p] ?? []).slice().sort();
  }, [project, groupsByProject, ungroupedGroups]);

  const [existingTemplates, setExistingTemplates] = useState([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const [existingTags, setExistingTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tags = useMemo(() => {
    return selectedTags.length ? selectedTags : null;
  }, [selectedTags]);
  
  const [imagePreview, setImagePreview] = useState(null);
  const [showImageIcon, setShowImageIcon] = useState(true);

  // Set template from effectiveTemplateFilter when not in edit mode
  useEffect(() => {
    if (!isEditMode && effectiveTemplateFilter) {
      setTemplate(effectiveTemplateFilter);
    }
  }, [effectiveTemplateFilter, isEditMode]);

  useEffect(() => {
    async function loadTemplatesAndTags() {
      try {
        const { data } = await client.models.Record.list({ limit: 500 });

        // Extract unique templates
        const templates = [...new Set(
          data
            .map(r => r.template)
            .filter(Boolean)
        )].sort();
        setExistingTemplates(templates);

        // Extract unique tags (flatten all tag arrays)
        const allTags = data
          .flatMap(r => r.tags || [])
          .filter(Boolean);
        const uniqueTags = [...new Set(allTags)].sort();
        setExistingTags(uniqueTags);
      } catch (err) {
        console.error("Failed to load templates and tags:", err);
      }
    }

    loadTemplatesAndTags();
    const handler = () => loadTemplatesAndTags();
    window.addEventListener("records:changed", handler);
    return () => window.removeEventListener("records:changed", handler);
  }, []);

  useEffect(() => {
    async function loadGroupings() {
      try {
        const { data } = await client.models.Record.list({ limit: 500 });

        // Parse groupings into project and group
        const allProjects = [];
        const allGroups = [];

        const map = {}; // project -> Set(groups)
        const unassigned = new Set();

        data.forEach(r => {
          if (!r.grouping) return;

          const match = r.grouping.match(/^\[(.*?)\]\s*(.*)$/);
          if (match) {
            const [, pRaw, gRaw] = match;
            const p = (pRaw ?? "").trim();
            const g = (gRaw ?? "").trim();

            if (p) allProjects.push(p);
            if (g) allGroups.push(g);

            if (p && g) {
              if (!map[p]) map[p] = new Set();
              map[p].add(g);
            }
          } else {
            // no project → unassigned group
            const g = r.grouping.trim();
            if (g) {
              unassigned.add(g);
              allGroups.push(g);
            }
          }
        });

        const uniqueProjects = [...new Set(allProjects)].filter(Boolean).sort();
        const uniqueGroups = [...new Set(allGroups)].filter(Boolean).sort();

        // convert Set -> array
        const normalizedMap = Object.fromEntries(
          Object.entries(map).map(([p, set]) => [p, [...set].sort()])
        );

        setExistingProjects(uniqueProjects);
        setExistingGroups(uniqueGroups);
        setGroupsByProject(normalizedMap);

        setUngroupedGroups([...unassigned].sort());

      } catch (err) {
        console.error("Failed to load projects and groups:", err);
      }
    }

    loadGroupings();
    const handler = () => loadGroupings();
    window.addEventListener("records:changed", handler);
    return () => window.removeEventListener("records:changed", handler);
  }, []);

  // Populate form when editRecord changes
  useEffect(() => {
    if (editRecord) {
      setTitle(editRecord.title ?? "");
      setStart(toLocalInputValue(editRecord.start));
      setEnd(toLocalInputValue(editRecord.end));
      setNotes(editRecord.notes ?? "");
      setNoteHtml(editRecord.notes ? renderToStaticMarkup(<ReactMarkdown>{editRecord.notes}</ReactMarkdown>) : "");
      setSelectedTags(editRecord.tags ?? []);
      setTemplate(editRecord.template ?? "");
      setStatus(editRecord.status ?? "");

      // Parse grouping into project and group
      if (editRecord.grouping) {
        const { project: parsedProject, group: parsedGroup } = parseGrouping(editRecord.grouping);
        setProject(parsedProject || "");
        setGroup(parsedGroup || "");
      } else {
        setProject("");
        setGroup("");
      }

      setImageFile(null);
      setImagePreview(editRecord.imageUrl ?? null);
      // Only set showForm if setShowForm is available (not in edit mode within list)
      if (setShowForm) {
        setShowForm(true);
      }
    }
  }, [editRecord, setShowForm]);

  async function uploadAndCreate() {
    if (!file) return;

    // 1) Upload to S3
    const key = `public/${crypto.randomUUID()}-${file.name}`;

    await uploadData({
      path: key,
      data: file,
      options: { contentType: file.type },
    }).result;

    await client.models.Record.create({
      title: "Record with image",
      imageKey: key,
    });

    setFile(null);
  }

  async function onSubmit(e) {
    e.preventDefault();

    if (!title.trim()) return;

    setSaving(true);
    try {
      let nextImageKey = editRecord?.imageKey ?? null;

      // 1) upload new image if selected
      if (imageFile && imageFile instanceof File) {
        nextImageKey = `public/${crypto.randomUUID()}-${imageFile.name}`;
        await uploadData({
          path: nextImageKey,
          data: imageFile,
          options: { contentType: imageFile.type },
        }).result;
      }

      // Combine project and group into grouping format
      const combinedGrouping = formatGrouping(project, group);

      const payload = {
        title: title.trim(),
        start: toIsoOrNull(start),
        end: toIsoOrNull(end),
        notes: notes.trim() ? notes.trim() : null,
        tags,
        template: template.trim() ? template.trim() : null,
        status: status.trim() ? status.trim() : null,
        grouping: combinedGrouping,
        imageKey: nextImageKey,
      };

      if (isEditMode) {
        // Update existing record
        const { errors } = await client.models.Record.update({
          id: editRecord.id,
          ...payload,
        });

        if (errors?.length) {
          console.log(errors);
          throw new Error(errors.map((x) => x.message).join("; "));
        }

        // Delete old image if we uploaded a new one
        if (imageFile && imageFile instanceof File && editRecord.imageKey && editRecord.imageKey !== nextImageKey) {
          await remove({ path: editRecord.imageKey });
        }
      } else {
        // Create new record
        const { data, errors } = await client.models.Record.create(payload);
        console.log(data);
        if (errors?.length) {
          console.log(errors);
          throw new Error(errors.map((x) => x.message).join("; "));
        }
        if (!data?.id) {
          console.log("Create failed: no record returned.");
          throw new Error("Create failed: no record returned.");
        }
      }

      // Reset form
      setTitle("");
      setStart("");
      setEnd("");
      setNotes("");
      setNoteHtml("");
      setSelectedTags([]);
      setTemplate("");
      setStatus("");
      setProject("");
      setGroup("");
      setImageFile(null);
      setImagePreview(null);
      setShowNewTagInput(false);
      setNewTagInput("");
      setShowTagDropdown(false);
      setShowTemplateDropdown(false);
      setShowProjectDropdown(false);
      setShowGroupDropdown(false);
      setShowNewProjectInput(false);
      setShowNewGroupInput(false);
      setNewProjectInput("");
      setNewGroupInput("");

      // Let the list know to refresh
      window.dispatchEvent(new Event("records:changed"));

      // Call onCancelEdit if in edit mode
      if (isEditMode && onCancelEdit) {
        onCancelEdit();
      }
    } catch (err) {
      console.error(err);
      alert(`Save failed: ${err?.message ?? err}`);
    } finally {
      if (setShowForm) {
        setShowForm(false);
      }
      setSaving(false);
    }
  }

  function handleShowForm() {
    if (setShowForm) {
      setShowForm(true);
    }
    // Set start time to now
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now.getTime() - offsetMs)
    const localDateTime = localNow.toISOString().slice(0, 16)
    setStart(localDateTime);
  }

  function handleCancelForm() {
    
    divRef.current?.scrollIntoView({ top: 0, behavior: "smooth" });
    if (setShowForm) {
      setShowForm(false);
    }
    // Clear all form values
    setTitle("");
    setStart("");
    setEnd("");
    setNotes("");
    setNoteHtml("");
    setSelectedTags([]);
    setTemplate("");
    setStatus("");
    setProject("");
    setGroup("");
    setImageFile(null);
    setImagePreview(null);
    setShowNewTagInput(false);
    setNewTagInput("");
    setShowTagDropdown(false);
    setShowTemplateDropdown(false);
    setShowProjectDropdown(false);
    setShowGroupDropdown(false);
    setShowNewProjectInput(false);
    setShowNewGroupInput(false);
    setNewProjectInput("");
    setNewGroupInput("");
    setShowImageIcon(true);

    // Call onCancelEdit if in edit mode
    if (isEditMode && onCancelEdit) {
      onCancelEdit();
    }
  }

  function onEditChange(e) {
    setNoteHtml(e.target.value);
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(e.target.value)
    setNotes(markdown)
  }

  return (
    <div className="container" style={{ display: "flex"  }}>
      {(showForm || isEditMode) && (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, width: "100%" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Title *</label>
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Gym session"
                required
                style={{ padding: 10, fontSize: "16px" }}
              />
              {showImageIcon && (
                <AddAPhotoIcon onClick={() => setShowImageIcon(false)} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", color: "#999" }} />
              )}
            </div>
          </div>

          {!showImageIcon && (<div style={{ display: "grid", gap: 4 }}>
            <input
              id="image-upload-input"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setImageFile(file);
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setImagePreview(reader.result);
                  };
                  reader.readAsDataURL(file);
                } else {
                  setImagePreview(null);
                }
              }}
              style={{ display: "none" }}
            />
            <label
              htmlFor="image-upload-input"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px dashed #ccc",
                borderRadius: 8,
                padding: 8,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {imagePreview ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      maxHeight: 128,
                      objectFit: "contain",
                      borderRadius: 4
                    }}
                  />
                  <div style={{ fontSize: 12, color: "#666" }}>
                    <span style={{ fontSize: 11, color: "#999" }}> - Click to change - </span>
                     {imageFile?.name} ({Math.round((imageFile?.size ?? 0) / 1024)} KB)
                  </div>
                  
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <AddAPhotoIcon style={{ fontSize: 40, color: "#999" }} />
                  <div style={{ fontSize: 14, color: "#666" }}>Add Photo</div>
                </div>
              )}
            </label>
          </div>)}

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Notes</label>
            <Editor value={noteHtml} onChange={onEditChange} />
          </div>

          <div ref={divRef} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Template</label>
              <div style={{ position: "relative" }}>
                <div
                  className="input"
                  onClick={() => {
                    if (!effectiveTemplateFilter) {
                      setShowTemplateDropdown(!showTemplateDropdown);
                      setShowTagDropdown(false);
                    }
                  }}
                  style={{ cursor: effectiveTemplateFilter ? 'default' : 'pointer', opacity: effectiveTemplateFilter ? 0.7 : 1 }}
                >
                  {(effectiveTemplateFilter || template) ? (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {getTemplateIcon(effectiveTemplateFilter || template)}
                      <span>{effectiveTemplateFilter || template}</span>
                    </div>
                  ) : (
                    <span>-- Select or leave empty --</span>
                  )}
                </div >
                {showTemplateDropdown && !effectiveTemplateFilter && (
                  <div className="dropDown">
                    <div
                      onClick={() => {
                        setTemplate("");
                        setShowTemplateDropdown(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer"
                      }}
                      className="dropDown"
                      onMouseEnter={(e) => e.currentTarget.className = "hover"}
                        onMouseLeave={(e) => e.currentTarget.className = ""}
                    >
                      -- None --
                    </div>
                    {existingTemplates.map(t => (
                      <div
                        key={t}
                        onClick={() => {
                          setTemplate(t);
                          setShowTemplateDropdown(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "8px 12px",
                          cursor: "pointer"
                        }}
                        onMouseEnter={(e) => e.currentTarget.className = "hover"}
                        onMouseLeave={(e) => e.currentTarget.className = ""}
                      >
                        {getTemplateIcon(t)}
                        {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="-- Select or leave empty --"
                className="input"
              >
                <option  value="">-- Select or leave empty --</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Tags</label>
              <div style={{ position: "relative" }}>
                <div
                  onClick={() => {
                    setShowTagDropdown(!showTagDropdown); 
                    setShowTemplateDropdown(false);
                  }}
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    padding: 8,
                    minHeight: 40,
                    cursor: "pointer"
                  }}
                  className="input"
                >
                  {selectedTags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            display: "contents",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTags(selectedTags.filter(t => t !== tag));
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: 14,
                              fontWeight: "bold"
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  {selectedTags.length > 0 ? (
                    <div className="dropDown" style={{ display: "flex", gap: 6 }}>
                      
                    </div>
                  ) : (
                    <span style={{ color: "#999" }}>Select tags...</span>
                  )}
                </div>
                {showTagDropdown && (
                  <div
                    className="dropDown"
                  >
                    {existingTags.map(tag => (
                      <label
                        key={tag}
                        onMouseEnter={(e) => e.currentTarget.className = "hover"}
                        onMouseLeave={(e) => e.currentTarget.className = ""}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTags([...selectedTags, tag]);
                            } else {
                              setSelectedTags(selectedTags.filter(t => t !== tag));
                            }
                          }}
                          style={{ marginRight: 8 }}
                        />
                        {tag}
                      </label>
                    ))}
                    <div>
                      {!showNewTagInput ? (
                        <button type="button" onClick={() => setShowNewTagInput(true)}>
                          + Create new tag
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="text"
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            placeholder="Enter new tag"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const trimmed = newTagInput.trim();
                                if (trimmed && !selectedTags.includes(trimmed)) {
                                  setSelectedTags([...selectedTags, trimmed]);
                                  setExistingTags([...existingTags, trimmed].sort());
                                }
                                setNewTagInput("");
                                setShowNewTagInput(false);
                              }
                            }}
                            style={{ width: "60%" }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newTagInput.trim();
                              if (trimmed && !selectedTags.includes(trimmed)) {
                                setSelectedTags([...selectedTags, trimmed]);
                                setExistingTags([...existingTags, trimmed].sort());
                              }
                              setNewTagInput("");
                              setShowNewTagInput(false);
                            }}
                            className="txt-button"
                            style={{ width: "30%" }}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewTagInput("");
                              setShowNewTagInput(false);
                            }}
                            style={{ padding: "4px 12px", width: "10%" }}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, padding: 6, border: "1px solid #ccc", borderRadius: 4 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Project</label>
              <div style={{ position: "relative" }}>
                <div
                  className="input"
                  onClick={() => {
                    setShowProjectDropdown(!showProjectDropdown);
                    setShowGroupDropdown(false);
                    setShowTagDropdown(false);
                    setShowTemplateDropdown(false);
                  }}
                >
                  {project ? (
                    <span>{project}</span>
                  ) : (
                    <span style={{ color: "#999" }}>-- Select or add new --</span>
                  )}
                </div>
                {showProjectDropdown && (
                  <div className="dropDown">
                    <div
                      onClick={() => {
                        setProject("");
                        setShowProjectDropdown(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => e.currentTarget.className = "hover"}
                      onMouseLeave={(e) => e.currentTarget.className = ""}
                    >
                      -- None --
                    </div>
                    {existingProjects.map(p => (
                      <div
                        key={p}
                        onClick={() => {
                          setProject(p);
                          setGroup(""); // reset group when project changes
                          setShowProjectDropdown(false);
                        }}
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer"
                        }}
                        onMouseEnter={(e) => e.currentTarget.className = "hover"}
                        onMouseLeave={(e) => e.currentTarget.className = ""}
                      >
                        {p}
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid #ccc", marginTop: 4, paddingTop: 4 }}>
                      {!showNewProjectInput ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowNewProjectInput(true);
                          }}
                          style={{ width: "100%" }}
                        >
                          + Add new project
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 6, padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={newProjectInput}
                            onChange={(e) => setNewProjectInput(e.target.value)}
                            placeholder="Enter new project"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const trimmed = newProjectInput.trim();
                                if (trimmed) {
                                  setProject(trimmed);
                                  setGroup(""); // reset group when project changes
                                  setExistingProjects([...existingProjects, trimmed].sort());
                                }
                                setNewProjectInput("");
                                setShowNewProjectInput(false);
                                setShowProjectDropdown(false);
                              }
                            }}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newProjectInput.trim();
                              if (trimmed) {
                                setProject(trimmed);
                                setGroup(""); // reset group when project changes
                                setExistingProjects([...existingProjects, trimmed].sort());
                              }
                              setNewProjectInput("");
                              setShowNewProjectInput(false);
                              setShowProjectDropdown(false);
                            }}
                            style={{ padding: "4px 8px" }}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewProjectInput("");
                              setShowNewProjectInput(false);
                            }}
                            style={{ padding: "4px 8px" }}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Group</label>
              <div style={{ position: "relative" }}>
                <div
                  className="input"
                  onClick={() => {
                    setShowGroupDropdown(!showGroupDropdown);
                    setShowProjectDropdown(false);
                    setShowTagDropdown(false);
                    setShowTemplateDropdown(false);
                  }}
                >
                  {group ? (
                    <span>{group}</span>
                  ) : (
                    <span style={{ color: "#999" }}>-- Select or add new --</span>
                  )}
                </div>
                {showGroupDropdown && (
                  <div className="dropDown">
                    <div
                      onClick={() => {
                        setGroup("");
                        setShowGroupDropdown(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer"
                      }}
                      onMouseEnter={(e) => e.currentTarget.className = "hover"}
                      onMouseLeave={(e) => e.currentTarget.className = ""}
                    >
                      -- None --
                    </div>
                    {filteredGroups.map(g => (
                      <div
                        key={g}
                        onClick={() => {
                          setGroup(g);
                          setShowGroupDropdown(false);
                        }}
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer"
                        }}
                        onMouseEnter={(e) => e.currentTarget.className = "hover"}
                        onMouseLeave={(e) => e.currentTarget.className = ""}
                      >
                        {g}
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid #ccc", marginTop: 4, paddingTop: 4 }}>
                      {!showNewGroupInput ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowNewGroupInput(true);
                          }}
                          style={{ width: "100%" }}
                        >
                          + Add new group
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 6, padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={newGroupInput}
                            onChange={(e) => setNewGroupInput(e.target.value)}
                            placeholder="Enter new group"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const trimmed = newGroupInput.trim();
                                if (trimmed) {
                                  setGroup(trimmed);
                                  setExistingGroups([...existingGroups, trimmed].sort());
                                }
                                setNewGroupInput("");
                                setShowNewGroupInput(false);
                                setShowGroupDropdown(false);
                              }
                            }}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newGroupInput.trim();
                              if (trimmed) {
                                setGroup(trimmed);
                                setExistingGroups([...existingGroups, trimmed].sort());
                              }
                              setNewGroupInput("");
                              setShowNewGroupInput(false);
                              setShowGroupDropdown(false);
                            }}
                            style={{ padding: "4px 8px" }}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewGroupInput("");
                              setShowNewGroupInput(false);
                            }}
                            style={{ padding: "4px 8px" }}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, padding: 6, border: "1px solid #ccc", borderRadius: 4 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Start</label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                style={{ padding: 10, fontSize: "16px" }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>End</label>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                style={{ padding: 10, fontSize: "16px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button className="txt-button" disabled={saving} >
              {saving ? "Saving..." : (isEditMode ? "Update" : "Save")}
            </button>
            {isEditMode ?( <button className="txt-button" onClick={() => handleCancelForm() }>
              Cancel
            </button>): ('')}
          </div>
        </form>
      )}
      {!isEditMode && (
        <div style={{ marginLeft: "auto", maxHeight: "1.5em", position: "fixed", right: 0, top: 0, zIndex: 1000 }}>
          <IconButton aria-label="close" onClick={() => showForm ? handleCancelForm() : handleShowForm()} >
            {showForm ? <CloseOutlinedIcon /> : <AddCircleIcon sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }} />}
          </IconButton>
        </div>
      )}
    </div>
  );
}
