import { useEffect, useMemo, useRef, useState } from "react";
import { uploadData, remove } from "aws-amplify/storage";
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import ReactMarkdown from "react-markdown";
import Editor from 'react-simple-wysiwyg';
import TurndownService from 'turndown';

import IconButton from '@mui/material/IconButton'
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import UpdateIcon from '@mui/icons-material/Update';

import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

import { toIsoOrNull, toLocalInputValue } from "./utils/dateUtils";
import { parseGrouping, formatGrouping } from "./utils/groupingUtils";
import { getTemplateIcon } from "./utils/iconUtils";
import { useRecordForm } from "./hooks/useRecordForm";
import { useDropdowns } from "./hooks/useDropdowns";
import { useRecordMetadata } from "./hooks/useRecordMetadata";
import { generateClient } from "aws-amplify/data";

import { createRelationship, listRelationshipsForRecord, deleteRelationship } from "./utils/recordRelationships";

Amplify.configure(outputs);
const client = generateClient();

export default function RecordForm({ templateFilter, editRecord, onCancelEdit, showForm, setShowForm, selectedProject, selectedGroup, selectedTemplate, records, loadRelationships }) {
  // Custom hooks for consolidated state management
  const { formState, setField, setMultipleFields, resetForm } = useRecordForm();
  const { toggleDropdown,isOpen, newInputs,showNewInput,
    hideNewInput, setNewInputValue, resetAllDropdowns} = useDropdowns();
  const [saving, setSaving] = useState(false);
  const [showImageIcon, setShowImageIcon] = useState(true);
  const {
    templates: existingTemplates,
    tags: existingTags,
    projects: existingProjects,
    groupsByProject,
    ungroupedGroups,
  } = useRecordMetadata();

  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [availableGroupsByProject, setAvailableGroupsByProject] = useState({});
  const [availableUngroupedGroups, setAvailableUngroupedGroups] = useState([]);

  const isEditMode = !!editRecord;

  // If templateFilter is "Project", treat it as no filter. Otherwise, use it as a hard-coded template value.
  const effectiveTemplateFilter = templateFilter?.toLowerCase() === 'project' ? '': templateFilter;

  const divRef = useRef(null);

  const [relationshipType, setRelationshipType] = useState("related_to");
  const [targetRecordId, setTargetRecordId] = useState("");
  const [relationshipNote, setRelationshipNote] = useState("");
  const [existingRelationships, setExistingRelationships] = useState([]);
  const [editRelationshipId, setEditRelationshipId] = useState(null);

  const loadExistingRelationships = async (recordId) => {
    if (!recordId) {
      setExistingRelationships([]);
      return;
    }

    try {
      const data = await listRelationshipsForRecord(recordId);
      setExistingRelationships(data ?? []);
    } catch (err) {
      console.error("Failed to load existing relationships", err);
    }
  };

  useEffect(() => {
    if (formState.id) {
      loadExistingRelationships(formState.id);
    } else {
      setExistingRelationships([]);
    }
  }, [formState.id]);

  useEffect(() => {
    setAvailableTemplates(existingTemplates);
    setAvailableTags(existingTags);
    setAvailableProjects(existingProjects);
    setAvailableGroupsByProject(groupsByProject);
    setAvailableUngroupedGroups(ungroupedGroups);
  }, [existingTemplates, existingTags, existingProjects, groupsByProject, ungroupedGroups]);

  // Computed values
  const filteredGroups = useMemo(() => {
    const p = formState.project.trim();
    if (!p) return availableUngroupedGroups;
    return (availableGroupsByProject[p] ?? []).slice().sort();
  }, [formState.project, availableGroupsByProject, availableUngroupedGroups]);

  const tags = useMemo(() => {
    return formState.selectedTags.length ? formState.selectedTags : null;
  }, [formState.selectedTags]);

  // Reset form when template filter changes (not in edit mode)
  useEffect(() => {
    if (!isEditMode) {
      resetForm({
        template: effectiveTemplateFilter || '',
      });
      resetAllDropdowns();
    }
  }, [templateFilter, isEditMode, resetForm, resetAllDropdowns, effectiveTemplateFilter]);

  // Set project and group from selected context when not in edit mode
  useEffect(() => {
    if (!isEditMode) {
      setMultipleFields({
        project: selectedProject || '',
        group: selectedGroup || '',
        template: selectedTemplate || '',
      });
    }
  }, [selectedProject, selectedGroup, selectedTemplate, isEditMode, setMultipleFields]);

  // Populate form when editRecord changes
  useEffect(() => {
    if (editRecord) {
      // Parse grouping into project and group
      const { project: parsedProject, group: parsedGroup } = editRecord.grouping
        ? parseGrouping(editRecord.grouping)
        : { project: null, group: null };

      setMultipleFields({
        id: editRecord.id,
        title: editRecord.title ?? "",
        start: toLocalInputValue(editRecord.start),
        end: toLocalInputValue(editRecord.end),
        notes: editRecord.notes ?? "",
        noteHtml: editRecord.notes ? renderToStaticMarkup(<ReactMarkdown>{editRecord.notes}</ReactMarkdown>) : "",
        selectedTags: editRecord.tags ?? [],
        template: editRecord.template ?? "",
        status: editRecord.status ?? "",
        project: parsedProject || "",
        group: parsedGroup || "",
        imageFile: null,
        imagePreview: editRecord.imageUrl ?? null,
      });

      // Only set showForm if setShowForm is available (not in edit mode within list)
      if (setShowForm) {
        setShowForm(true);
      }
    }
  }, [editRecord, setShowForm, setMultipleFields]);

  const turndownService = useMemo(() => new TurndownService(), []);

  async function onSubmit(e) {
    e.preventDefault();

    if (!formState.title.trim()) return;

    setSaving(true);
    try {
      let nextImageKey = editRecord?.imageKey ?? null;

      // 1) upload new image if selected
      if (formState.imageFile && formState.imageFile instanceof File) {
        nextImageKey = `public/${crypto.randomUUID()}-${formState.imageFile.name}`;
        await uploadData({
          path: nextImageKey,
          data: formState.imageFile,
          options: { contentType: formState.imageFile.type },
        }).result;
      }

      // Combine project and group into grouping format
      const combinedGrouping = formatGrouping(formState.project, formState.group);

      const payload = {
        title: formState.title.trim(),
        start: toIsoOrNull(formState.start),
        end: toIsoOrNull(formState.end),
        notes: formState.notes.trim() ? formState.notes.trim() : null,
        tags,
        template: formState.template.trim() ? formState.template.trim() : null,
        status: formState.status.trim() ? formState.status.trim() : null,
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
        if (formState.imageFile && formState.imageFile instanceof File && editRecord.imageKey && editRecord.imageKey !== nextImageKey) {
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
      resetForm();
      resetAllDropdowns();

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

  async function onRelationshipSubmit(e) {
    e.preventDefault();
    if (!formState.id) {
      alert("Save the record before adding relationships.");
      return;
    }

    if (!targetRecordId) {
      alert("Select a target record.");
      return;
    }

    if (formState.id === targetRecordId) {
      alert("A record cannot link to itself.");
      return;
    }

    if (editRelationshipId) {
      const { errors } = await client.models.RecordRelationship.update({
        id: editRelationshipId,
        sourceRecordId: formState.id,
        targetRecordId,
        type: relationshipType,
        note: relationshipNote || null,
      });
      if (errors?.length) {
        throw new Error(errors.map((x) => x.message).join("; "));
      }
    } else {
      const { data, errors } = await createRelationship(
        formState.id,
        targetRecordId,
        relationshipType,
        relationshipNote
      );

      if (errors?.length) {
        throw new Error(errors.map((x) => x.message).join("; "));
      }
      if (!data?.id) {
        throw new Error("Create failed: no relationship returned.");
      }
    }

    setRelationshipType("related_to");
    setTargetRecordId("");
    setRelationshipNote("");
    setEditRelationshipId(null);

    if (loadRelationships) {
      await loadRelationships();
    }

    await loadExistingRelationships(formState.id);
  };

  const onDeleteRelationship = async (relationshipId) => {
    await deleteRelationship(relationshipId);
    await loadExistingRelationships(formState.id);  // add this
    if (loadRelationships) {
      await loadRelationships();                     // and this, to sync the parent
    }
  }

  const onEditRelationship = (rel) => {
    setEditRelationshipId(rel.id);
    setRelationshipType(rel.type || "related_to");
    setTargetRecordId(rel.targetRecordId || "");
    setRelationshipNote(rel.note ?? "");
  };

  const cancelRelationshipEdit = () => {
    setEditRelationshipId(null);
    setRelationshipType("related_to");
    setTargetRecordId("");
    setRelationshipNote("");
  };

  function handleShowForm() {
    if (setShowForm) {
      setShowForm(true);
    }
    // Set start time to now
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now.getTime() - offsetMs)
    const localDateTime = localNow.toISOString().slice(0, 16)
    setField('start', localDateTime);
  }

  function handleCancelForm() {
    divRef.current?.scrollIntoView({ top: 0, behavior: "smooth" });
    if (setShowForm) {
      setShowForm(false);
    }
    // Clear all form values
    resetForm();
    resetAllDropdowns();
    setShowImageIcon(true);

    // Call onCancelEdit if in edit mode
    if (isEditMode && onCancelEdit) {
      onCancelEdit();
    }
  }

  function onEditChange(e) {
    const htmlValue = e.target.value;
    const markdown = turndownService.turndown(htmlValue);
    setMultipleFields({
      noteHtml: htmlValue,
      notes: markdown
    });
  }

  return (
    <div className="container flex-container">
      {(showForm || isEditMode) && (
        <form onSubmit={onSubmit} className="form-grid">
          <div className="form-group">
            <label className="label-bold">Title *</label>
            <div className="relative grid-auto-fit">
              <input
                value={formState.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="e.g., Gym session"
                required
                className="form-input"
              />
              {showImageIcon && (
                <AddAPhotoIcon onClick={() => setShowImageIcon(false)} className="icon-overlay" />
              )}
            </div>
          </div>

          {!showImageIcon && (<div className="form-group gap-4">
            <input
              id="image-upload-input"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setField('imageFile', file);
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setField('imagePreview', reader.result);
                  };
                  reader.readAsDataURL(file);
                } else {
                  setField('imagePreview', null);
                }
              }}
              style={{ display: "none" }}
            />
            <label
              htmlFor="image-upload-input"
              className="image-upload-label"
            >
              {formState.imagePreview ? (
                <div className="image-preview-center gap-6">
                  <img
                    src={formState.imagePreview}
                    alt="Preview"
                    className="image-preview"
                  />
                  <div className="image-info">
                    <span className="text-muted" style={{ fontSize: 11 }}> - Click to change - </span>
                     {formState.imageFile?.name} ({Math.round((formState.imageFile?.size ?? 0) / 1024)} KB)
                  </div>

                </div>
              ) : (
                <div className="flex-column flex-center gap-8">
                  <AddAPhotoIcon style={{ fontSize: 40, color: "#999" }} />
                  <div className="text-md image-info">Add Photo</div>
                </div>
              )}
            </label>
          </div>)}

          <div className="form-group">
            <label className="label-bold">Notes</label>
            <Editor containerProps={{ style: { maxHeight: '60vh', overflowY: 'auto' } }} 
              value={formState.noteHtml} onChange={onEditChange} />
          </div>

          <div ref={divRef} className="grid-auto-fit">
            <div className="form-group">
              <label className="label-bold">Template</label>
              <div className="relative">
                <div
                  className="input cursor-pointer"
                  onClick={() => {
                    if (!effectiveTemplateFilter) {
                      toggleDropdown('template');
                    }
                  }}
                  style={{ cursor: effectiveTemplateFilter ? 'default' : 'pointer', opacity: effectiveTemplateFilter ? 0.7 : 1 }}
                >
                  {(effectiveTemplateFilter || formState.template) ? (
                    <div className="flex-center">
                      {getTemplateIcon(effectiveTemplateFilter || formState.template)}
                      <span>{effectiveTemplateFilter || formState.template}</span>
                    </div>
                  ) : (
                    <span>-- Select or leave empty --</span>
                  )}
                </div >
                {isOpen('template') && !effectiveTemplateFilter && (
                  <div className="dropDown">
                    <div
                      onClick={() => {
                        setField('template', "");
                        toggleDropdown('template');
                      }}
                      className="dropDown pad-8 cursor-pointer"
                      onMouseEnter={(e) => e.currentTarget.className = "hover"}
                        onMouseLeave={(e) => e.currentTarget.className = ""}
                    >
                      -- None --
                    </div>
                    {availableTemplates.map(t => (
                      <div
                        key={t}
                        onClick={() => {
                          setField('template', t);
                          toggleDropdown('template');
                        }}
                        className="flex-center pad-8 cursor-pointer"
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
            <div className="form-group">
              <label className="label-bold">Status</label>
              <select
                value={formState.status}
                onChange={(e) => setField('status', e.target.value)}
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

          <div className="form-group">
              <label className="label-bold">Tags</label>
              <div className="relative">
                <div
                  onClick={() => {
                    toggleDropdown('tag');
                  }}
                  className="input tag-container"
                >
                  {formState.selectedTags.map(tag => (
                        <span
                          key={tag}
                          className="tag-chip"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setField('selectedTags', formState.selectedTags.filter(t => t !== tag));
                            }}
                            className="tag-remove-btn"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  {formState.selectedTags.length > 0 ? (
                    <div className="dropDown" style={{ display: "flex", gap: 6 }}>
                      
                    </div>
                  ) : (
                    <span style={{ color: "#999" }}>Select tags...</span>
                  )}
                </div>
                {isOpen('tag') && (
                  <div
                    className="dropDown"
                  >
                    {availableTags.map(tag => (
                      <label
                        key={tag}
                        onMouseEnter={(e) => e.currentTarget.className = "hover"}
                        onMouseLeave={(e) => e.currentTarget.className = ""}
                      >
                        <input
                          type="checkbox"
                          checked={formState.selectedTags.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setField('selectedTags', [...formState.selectedTags, tag]);
                            } else {
                              setField('selectedTags', formState.selectedTags.filter(t => t !== tag));
                            }
                          }}
                          style={{ marginRight: 8 }}
                        />
                        {tag}
                      </label>
                    ))}
                    <div>
                      {!newInputs.showTagInput ? (
                        <button type="button" onClick={() => showNewInput('Tag')}>
                          + Create new tag
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="text"
                            value={newInputs.tagValue}
                            onChange={(e) => setNewInputValue('Tag', e.target.value)}
                            placeholder="Enter new tag"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const trimmed = newInputs.tagValue.trim();
                                if (trimmed && !formState.selectedTags.includes(trimmed)) {
                                  setField('selectedTags', [...formState.selectedTags, trimmed]);
                                  setAvailableTags([...availableTags, trimmed].sort());
                                }
                                hideNewInput('Tag');
                              }
                            }}
                            style={{ width: "60%" }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newInputs.tagValue.trim();
                              if (trimmed && !formState.selectedTags.includes(trimmed)) {
                                setField('selectedTags', [...formState.selectedTags, trimmed]);
                                setAvailableTags([...availableTags, trimmed].sort());
                              }
                              hideNewInput('Tag');
                            }}
                            className="txt-button"
                            style={{ width: "30%" }}
                          >
                            
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              hideNewInput('Tag');
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
            
          <div className="form-section-bordered ">
            <div className="form-group">
              <label className="label-bold">Project</label>
              <div className="relative">
                <div
                  className="input"
                  onClick={() => {
                    toggleDropdown('project');
                  }}
                >
                  {formState.project ? (
                    <span>{formState.project}</span>
                  ) : (
                    <span className="text-muted">-- Select or add new --</span>
                  )}
                </div>
                {isOpen('project') && (
                  <div className="dropDown">
                    <div
                      onClick={() => {
                        setField('project', "");
                        toggleDropdown('project');
                      }}
                      className="pad-8 cursor-pointer"
                      onMouseEnter={(e) => e.currentTarget.className = "hover"}
                      onMouseLeave={(e) => e.currentTarget.className = ""}
                    >
                      -- None --
                    </div>
                    {availableProjects.map(p => (
                      <div
                        key={p}
                        onClick={() => {
                          setMultipleFields({ project: p, group: "" });
                          toggleDropdown('project');
                        }}
                        className="pad-8 cursor-pointer"
                        onMouseEnter={(e) => e.currentTarget.className = "hover"}
                        onMouseLeave={(e) => e.currentTarget.className = ""}
                      >
                        {p}
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid #ccc", marginTop: 4, paddingTop: 4 }}>
                      {!newInputs.showProjectInput ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showNewInput('Project');
                          }}
                          className="full-width"
                        >
                          + Add new project
                        </button>
                      ) : (
                        <div className="flex-container gap-6" style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={newInputs.projectValue}
                            onChange={(e) => setNewInputValue('Project', e.target.value)}
                            placeholder="Enter new project"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const trimmed = newInputs.projectValue.trim();
                                if (trimmed) {
                                  setMultipleFields({ project: trimmed, group: "" });
                                  setAvailableProjects([...availableProjects, trimmed].sort());
                                }
                                hideNewInput('Project');
                                toggleDropdown('project');
                              }
                            }}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newInputs.projectValue.trim();
                              console.log("Adding project:", trimmed);
                              if (trimmed) {
                                setMultipleFields({ project: trimmed, group: "" });
                                setAvailableProjects([...availableProjects, trimmed].sort());
                              }
                              hideNewInput('Project');
                              toggleDropdown('project');
                            }}
                            style={{ padding: "4px 8px" }}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              hideNewInput('Project');
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

            <div className="form-group">
              <label className="label-bold">Group</label>
              <div className="relative">
                <div
                  className="input cursor-pointer"
                  onClick={() => {
                    toggleDropdown('group');
                  }}
                >
                  {formState.group ? (
                    <span>{formState.group}</span>
                  ) : (
                    <span className="text-muted">-- Select or add new --</span>
                  )}
                </div>
                {isOpen('group') && (
                  <div className="dropDown">
                    <div
                      onClick={() => {
                        setField('group', "");
                        toggleDropdown('group');
                      }}
                      className="pad-8 cursor-pointer"
                      onMouseEnter={(e) => e.currentTarget.className = "hover"}
                      onMouseLeave={(e) => e.currentTarget.className = ""}
                    >
                      -- None --
                    </div>
                    {filteredGroups.map(g => (
                      <div
                        key={g}
                        onClick={() => {
                          setField('group', g);
                          toggleDropdown('group');
                        }}
                        className="pad-8 cursor-pointer"
                        onMouseEnter={(e) => e.currentTarget.className = "hover"}
                        onMouseLeave={(e) => e.currentTarget.className = ""}
                      >
                        {g}
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid #ccc", marginTop: 4, paddingTop: 4 }}>
                      {!newInputs.showGroupInput ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            showNewInput('Group');
                          }}
                          className="full-width"
                        >
                          + Add new group
                        </button>
                      ) : (
                        <div className="flex-container gap-6" style={{ padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={newInputs.groupValue}
                            onChange={(e) => setNewInputValue('Group', e.target.value)}
                            placeholder="Enter new group"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const trimmed = newInputs.groupValue.trim();
                                if (trimmed) {
                                  setField('group', trimmed);
                                  if (formState.project.trim()) {
                                    setAvailableGroupsByProject({
                                      ...availableGroupsByProject,
                                      [formState.project]: [...(availableGroupsByProject[formState.project] ?? []), trimmed].sort(),
                                    });
                                  } else {
                                    setAvailableUngroupedGroups([...availableUngroupedGroups, trimmed].sort());
                                  }
                                }
                                hideNewInput('Group');
                                toggleDropdown('group');
                              }
                            }}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newInputs.groupValue.trim();
                              if (trimmed) {
                                setField('group', trimmed);
                                if (formState.project.trim()) {
                                  setAvailableGroupsByProject({
                                    ...availableGroupsByProject,
                                    [formState.project]: [...(availableGroupsByProject[formState.project] ?? []), trimmed].sort(),
                                  });
                                } else {
                                  setAvailableUngroupedGroups([...availableUngroupedGroups, trimmed].sort());
                                }
                              }
                              hideNewInput('Group');
                              toggleDropdown('group');
                            }}
                            style={{ padding: "4px 8px" }}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              hideNewInput('Group');
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

          <div className="form-section-bordered">
            <div className="form-group">
              <label className="label-bold">Start</label>
              <input
                type="datetime-local"
                value={formState.start}
                onChange={(e) => setField('start', e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="label-bold">End</label>
              <input
                type="datetime-local"
                value={formState.end}
                onChange={(e) => setField('end', e.target.value)}
                className="form-input"
              />
            </div>
          </div>
          
          {isEditMode ?(<><div className="form-section-bordered relationship-row">
            <div className="form-group">
              <label className="label-bold">Relation</label>
              <select
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
                className="input"
              >
                <option value="related_to">Related to</option>
                <option value="blocks">Blocks</option>
                <option value="depends_on">Depends on</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label-bold">Target</label>
              <select
                value={targetRecordId}
                onChange={(e) => setTargetRecordId(e.target.value)}
                className="input"
              >
                <option value="">Select a record</option>
                {records
                  .filter((record) => record.id !== editRecord?.id)
                  .map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.title}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label-bold"></label>
              <IconButton
                aria-label="add relationship" 
                onClick={onRelationshipSubmit}
              >
                <AddCircleIcon sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }} />
              </IconButton>
            </div>
            <>{existingRelationships.length > 0 && existingRelationships.map((rel) => {
              const targetTitle = records.find(r => r.id === rel.targetRecordId)?.title ?? rel.targetRecordId;
                return (<React.Fragment key={rel.targetRecordId}>
                  <div className="form-group">
                    <span className="input" style={{ border: '0' }}>{rel.type}</span>
                  </div>
                  <div className="form-group">
                    <span className="input" style={{ border: '0' }}>{targetTitle}</span>
                  </div>
                  <div className="form-group">
                    <IconButton
                      aria-label="delete relationship"
                      onClick={() => onDeleteRelationship(rel.id)}
                    >
                      <DeleteIcon sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }} />
                    </IconButton>
                  </div>
                </React.Fragment>);
              })}</>
          </div></>): ('')}
          <div className="flex-between gap-12">
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
        <div className="fixed-top-right">
          <span >{(formState.template || effectiveTemplateFilter) + ' ' +
    (formState.group ? formState.project+' - '+formState.group : (formState.project ? formState.project : ''))}</span>
          <IconButton aria-label="close" onClick={() => showForm ? handleCancelForm() : handleShowForm()} >
            {showForm ? <CloseOutlinedIcon /> : <AddCircleIcon sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }} />}
          </IconButton>
        </div>
      )}
    </div>
  );
}
