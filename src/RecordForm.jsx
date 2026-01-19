import { useEffect, useMemo, useState } from "react";
import { uploadData, remove } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import IconButton from '@mui/material/IconButton'
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ListIcon from '@mui/icons-material/List';
import CollectionsIcon from '@mui/icons-material/Collections';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';

const client = generateClient();

function toIsoOrNull(datetimeLocalValue) {
  // datetime-local returns "YYYY-MM-DDTHH:mm"
  if (!datetimeLocalValue) return null;
  const d = new Date(datetimeLocalValue);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toISOString().slice(0, 16);
}

export default function RecordForm({ templateFilter, editRecord, onCancelEdit }) {
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState(null);

  const isEditMode = !!editRecord;

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(""); // datetime-local
  const [end, setEnd] = useState(""); // datetime-local
  const [notes, setNotes] = useState("");
  const [template, setTemplate] = useState("");
  const [status, setStatus] = useState("");
  const [grouping, setGrouping] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const [existingTemplates, setExistingTemplates] = useState([]);
  const [existingTags, setExistingTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const tags = useMemo(() => {
    return selectedTags.length ? selectedTags : null;
  }, [selectedTags]);

  const getTemplateIcon = (template) => {
    if (!template) return null;
    const templateLower = template.toLowerCase();

    const iconStyle = { fontSize: "1em", marginRight: 6 };

    switch (templateLower) {
      case 'todo':
        return <PlaylistAddCheckIcon style={iconStyle} />;
      case 'project':
        return <AccountTreeIcon style={iconStyle} />;
      case 'tracker':
        return <StackedLineChartIcon style={iconStyle} />;
      case 'diary':
        return <AutoStoriesIcon style={iconStyle} />;
      case 'list':
        return <ListIcon style={iconStyle} />;
      case 'collection':
        return <CollectionsIcon style={iconStyle} />;
      default:
        return null;
    }
  };

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

  // Populate form when editRecord changes
  useEffect(() => {
    if (editRecord) {
      setTitle(editRecord.title ?? "");
      setStart(toLocalInputValue(editRecord.start));
      setEnd(toLocalInputValue(editRecord.end));
      setNotes(editRecord.notes ?? "");
      setSelectedTags(editRecord.tags ?? []);
      setTemplate(editRecord.template ?? "");
      setStatus(editRecord.status ?? "");
      setGrouping(editRecord.grouping ?? "");
      setImageFile(null);
      setImagePreview(editRecord.imageUrl ?? null);
      setShowForm(true);
    }
  }, [editRecord]);

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

      const payload = {
        title: title.trim(),
        start: toIsoOrNull(start),
        end: toIsoOrNull(end),
        notes: notes.trim() ? notes.trim() : null,
        tags,
        template: template.trim() ? template.trim() : null,
        status: status.trim() ? status.trim() : null,
        grouping: grouping.trim() ? grouping.trim() : null,
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
      setSelectedTags([]);
      setTemplate("");
      setStatus("");
      setGrouping("");
      setImageFile(null);
      setImagePreview(null);
      setShowNewTagInput(false);
      setNewTagInput("");
      setShowTagDropdown(false);
      setShowTemplateDropdown(false);

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
      setShowForm(false);
      setSaving(false);
    }
  }

  function handleShowForm() {
    setShowForm(true);
    // Set start time to now
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now.getTime() - offsetMs)
    const localDateTime = localNow.toISOString().slice(0, 16)
    setStart(localDateTime);
  }

  function handleCancelForm() {
    setShowForm(false);
    // Clear all form values
    setTitle("");
    setStart("");
    setEnd("");
    setNotes("");
    setSelectedTags([]);
    setTemplate("");
    setStatus("");
    setGrouping("");
    setImageFile(null);
    setImagePreview(null);
    setShowNewTagInput(false);
    setNewTagInput("");
    setShowTagDropdown(false);
    setShowTemplateDropdown(false);

    // Call onCancelEdit if in edit mode
    if (isEditMode && onCancelEdit) {
      onCancelEdit();
    }
  }

  return (
    <div className="container" style={{ display: "flex" }}>
      {showForm && (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, width: "100%" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Gym session"
              required
              style={{ padding: 10, fontSize: "16px" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
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
                padding: 16,
                cursor: "pointer",
                background: "#fafafa",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f0f0f0";
                e.currentTarget.style.borderColor = "#999";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fafafa";
                e.currentTarget.style.borderColor = "#ccc";
              }}
            >
              {imagePreview ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      maxWidth: 64,
                      maxHeight: 64,
                      objectFit: "contain",
                      borderRadius: 4
                    }}
                  />
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {imageFile?.name} ({Math.round((imageFile?.size ?? 0) / 1024)} KB)
                  </div>
                  <div style={{ fontSize: 11, color: "#999" }}>Click to change</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <AddAPhotoIcon style={{ fontSize: 40, color: "#999" }} />
                  <div style={{ fontSize: 14, color: "#666" }}>Add Photo</div>
                </div>
              )}
            </label>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={8}
              style={{ padding: 10, resize: "vertical", fontSize: "16px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Template</label>
              <div style={{ position: "relative" }}>
                <div
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    padding: 10,
                    cursor: "pointer",
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "16px"
                  }}
                >
                  {(templateFilter || template) ? (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {getTemplateIcon(templateFilter || template)}
                      <span>{templateFilter || template}</span>
                    </div>
                  ) : (
                    <span style={{ color: "#999" }}>-- Select or leave empty --</span>
                  )}
                </div>
                {showTemplateDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      background: "#fff",
                      maxHeight: 200,
                      overflowY: "auto",
                      zIndex: 1000,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                    }}
                  >
                    <div
                      onClick={() => {
                        setTemplate("");
                        setShowTemplateDropdown(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        color: "#999"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f5f5f5"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
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
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f5f5f5"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
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
                placeholder="e.g., active, done, cancelled"
                style={{ padding: 10, fontSize: "16px" }}
              >
                <option value="">-- Select or leave empty --</option>
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
                  onClick={() => setShowTagDropdown(!showTagDropdown)}
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    padding: 8,
                    minHeight: 40,
                    cursor: "pointer",
                    background: "#fff"
                  }}
                >
                  {selectedTags.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedTags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            background: "#e0e0e0",
                            padding: "4px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            display: "flex",
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
                    </div>
                  ) : (
                    <span style={{ color: "#999" }}>Select tags...</span>
                  )}
                </div>
                {showTagDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      background: "#fff",
                      maxHeight: 200,
                      overflowY: "auto",
                      zIndex: 1000,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                    }}
                  >
                    {existingTags.map(tag => (
                      <label
                        key={tag}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "8px 12px",
                          cursor: "pointer",
                          hover: { background: "#f5f5f5" }
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f5f5f5"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
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
                    <div
                      style={{
                        borderTop: "1px solid #e0e0e0",
                        padding: 8
                      }}
                    >
                      {!showNewTagInput ? (
                        <button
                          type="button"
                          onClick={() => setShowNewTagInput(true)}
                          style={{
                            width: "100%",
                            padding: "6px 12px",
                            background: "#f5f5f5",
                            border: "1px solid #ddd",
                            borderRadius: 4,
                            cursor: "pointer"
                          }}
                        >
                          + Create new tag
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="text"
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            placeholder="Enter new tag"
                            style={{ flex: 1, padding: 6, border: "1px solid #ddd", borderRadius: 4 }}
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
                            style={{ padding: "4px 12px" }}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewTagInput("");
                              setShowNewTagInput(false);
                            }}
                            style={{ padding: "4px 12px" }}
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
            <label style={{ fontWeight: 600 }}>Grouping</label>
            <input
              value={grouping}
              onChange={(e) => setGrouping(e.target.value)}
              placeholder="e.g., 2026, fitness, work"
              style={{ padding: 10, fontSize: "16px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
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
            <button type="submit" disabled={saving} className="button-43">
              {saving ? "Saving..." : (isEditMode ? "Update" : "Save")}
            </button>
            {isEditMode ?( <button onClick={() => handleCancelForm() }>
              Cancel
            </button>): ('')}
          </div>
        </form>
      )}
      {!isEditMode && (
        <div style={{ marginLeft: "auto", maxHeight: "1.5em" }}>
          <IconButton aria-label="close" onClick={() => showForm ? handleCancelForm() : handleShowForm()} >
            {showForm ? <CloseOutlinedIcon /> : <AddCircleOutlineIcon />}
          </IconButton>
        </div>
      )}
    </div>
  );
}
