/**
 * Grouping utility functions for parsing and formatting project/group strings
 * Format: "[Project] Group" or just "Group" if no project
 */

/**
 * Parses a grouping string into project and group parts
 * @param {string} grouping - Format: "[Project] Group" or "Group"
 * @returns {{project: string|null, group: string|null}} Parsed project and group
 */
export function parseGrouping(grouping) {
  if (!grouping) return { project: null, group: null };

  // Check for bracket format: [Project] Group
  const match = grouping.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    const [, projectPart, groupPart] = match;
    return {
      project: (projectPart || "").trim(),
      group: (groupPart || "").trim()
    };
  }

  // No brackets found, treat entire string as group
  return {
    project: null,
    group: grouping.trim()
  };
}

/**
 * Formats project and group into a grouping string
 * @param {string} project - Project name
 * @param {string} group - Group name
 * @returns {string|null} Formatted grouping string or null if both empty
 */
export function formatGrouping(project, group) {
  const trimmedProject = project.trim();
  const trimmedGroup = group.trim();

  if (trimmedProject && trimmedGroup) {
    return `[${trimmedProject}] ${trimmedGroup}`;
  } else if (trimmedGroup) {
    return trimmedGroup;
  } else if (trimmedProject) {
    return `[${trimmedProject}]`;
  }
  return null;
}
