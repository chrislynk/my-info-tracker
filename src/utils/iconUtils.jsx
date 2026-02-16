/**
 * Icon utility functions for template icons
 */
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ListIcon from '@mui/icons-material/List';
import CollectionsIcon from '@mui/icons-material/Collections';

/**
 * Returns the appropriate icon component for a given template type
 * @param {string} template - Template type (e.g., 'Todo', 'Project', 'Tracker')
 * @param {string} size - Icon size (default: "1em")
 * @returns {JSX.Element|null} Icon component or null if no match
 */
export function getTemplateIcon(template, size = "1em") {
  if (!template) return null;
  const templateLower = template.toLowerCase();
  const iconStyle = { fontSize: size, marginRight: 6 };

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
}
