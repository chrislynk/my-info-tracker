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
    <ButtonGroup variant="contained" aria-label="icon button bar" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <Tooltip title="ToDo">
        <IconButton onClick={() => setTemplateFilter(templateFilter === "ToDo" ? "" : "ToDo")} aria-label="all" color={templateFilter === "ToDo" ? "primary" : "default"}>
          <PlaylistAddCheckIcon style={{ fontSize: "1.5em" }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Project">
        <IconButton onClick={() => setTemplateFilter(templateFilter === "Project" ? "" : "Project")} aria-label="project" color={templateFilter === "Project" ? "primary" : "default"}>
          <AccountTreeIcon style={{ fontSize: "1.5em" }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Tracker">
        <IconButton onClick={() => setTemplateFilter(templateFilter === "Tracker" ? "" : "Tracker")} aria-label="tracker" color={templateFilter === "Tracker" ? "primary" : "default"}>
          <StackedLineChartIcon style={{ fontSize: "1.5em" }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Diary">
        <IconButton onClick={() => setTemplateFilter(templateFilter === "Diary" ? "" : "Diary")} aria-label="diary" color={templateFilter === "Diary" ? "primary" : "default"}>
          <AutoStoriesIcon style={{ fontSize: "1.5em" }} />
        </IconButton>
      </Tooltip>
    </ButtonGroup>
  );
}

export default IconButtonBar;
