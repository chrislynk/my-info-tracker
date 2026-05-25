import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { parseGrouping } from "../utils/groupingUtils";

const client = generateClient();

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

export function useRecordMetadata() {
  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);
  const [projects, setProjects] = useState([]);
  const [groupsByProject, setGroupsByProject] = useState({});
  const [ungroupedGroups, setUngroupedGroups] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const { data } = await client.models.Record.list({ limit: 500 });

        const allTemplates = [];
        const allTags = [];
        const allProjects = [];
        const allGroups = [];
        const groupsForProject = {};
        const unassigned = new Set();

        data.forEach((record) => {
          if (record.template) {
            allTemplates.push(record.template);
          }

          (record.tags || []).forEach((tag) => {
            if (tag) allTags.push(tag);
          });

          const { project, group } = parseGrouping(record.grouping);
          if (project) {
            allProjects.push(project);
          }

          if (group) {
            allGroups.push(group);
          }

          if (project && group) {
            groupsForProject[project] = groupsForProject[project] || new Set();
            groupsForProject[project].add(group);
          } else if (group) {
            unassigned.add(group);
          }
        });

        if (!isMounted) return;

        setTemplates(uniqueSorted(allTemplates));
        setTags(uniqueSorted(allTags));
        setProjects(uniqueSorted(allProjects));
        setGroupsByProject(
          Object.fromEntries(
            Object.entries(groupsForProject).map(([project, set]) => [project, [...set].sort()])
          )
        );
        setUngroupedGroups([...unassigned].sort());
      } catch (error) {
        console.error("Failed to load record metadata:", error);
      }
    }

    load();
    window.addEventListener("records:changed", load);

    return () => {
      isMounted = false;
      window.removeEventListener("records:changed", load);
    };
  }, []);

  return {
    templates,
    tags,
    projects,
    groupsByProject,
    ungroupedGroups,
  };
}
