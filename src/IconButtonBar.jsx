import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import ButtonGroup from '@mui/material/ButtonGroup';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import Tooltip from '@mui/material/Tooltip';

const IconButtonBar = ({ setTemplateFilter, templateFilter }) => {
  return (
    <ButtonGroup
      variant="contained"
      aria-label="icon button bar"
      className="flex-between gap-4 full-width"
    >
      <Tooltip title="ToDo">
        <IconButton
          onClick={() => setTemplateFilter(templateFilter === "ToDo" ? "" : "ToDo")}
          aria-label="all"
          color={templateFilter === "ToDo" ? "primary" : "default"}
          sx={{ flex: "1 1 0", minWidth: 0, padding: { xs: 1, sm: 1.5 }, backgroundColor: templateFilter === "ToDo" ? "#e5edff" : "default" }}
        >
          <PlaylistAddCheckIcon sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Project">
        <IconButton
          onClick={() => setTemplateFilter(templateFilter === "Project" ? "" : "Project")}
          aria-label="project"
          color={templateFilter === "Project" ? "primary" : "default"}
          sx={{ flex: "1 1 0", minWidth: 0, padding: { xs: 1, sm: 1.5 }, backgroundColor: templateFilter === "Project" ? "#e5edff" : "default" }}
        >
          <AccountTreeIcon sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Tracker">
        <IconButton
          onClick={() => setTemplateFilter(templateFilter === "Tracker" ? "" : "Tracker")}
          aria-label="tracker"
          color={templateFilter === "Tracker" ? "primary" : "default"}
          sx={{ flex: "1 1 0", minWidth: 0, padding: { xs: 1, sm: 1.5 }, backgroundColor: templateFilter === "Tracker" ? "#e5edff" : "default" }}
        >
          <StackedLineChartIcon sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Diary">
        <IconButton
          onClick={() => setTemplateFilter(templateFilter === "Diary" ? "" : "Diary")}
          aria-label="diary"
          color={templateFilter === "Diary" ? "primary" : "default"}
          sx={{ flex: "1 1 0", minWidth: 0, padding: { xs: 1, sm: 1.5 }, backgroundColor: templateFilter === "Diary" ? "#e5edff" : "default" }}
        >
          <AutoStoriesIcon sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }} />
        </IconButton>
      </Tooltip>
    </ButtonGroup>
  );
}

export default IconButtonBar;
