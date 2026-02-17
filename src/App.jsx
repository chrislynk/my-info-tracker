import { uploadData, getUrl } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import React, { useState, useEffect } from "react";
import RecordForm from "./RecordForm";
import RecordList from "./RecordList";
import IconButtonBar from "./IconButtonBar";
import "./index.css";

const client = generateClient();

export default function App() {
  const [searchItem, setSearchItem] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showHoverSearch, setShowHoverSearch] = useState(false);
  const [isScrolledPastSearch, setIsScrolledPastSearch] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      // Check if scrolled past approximately 150px (header + search input area)
      setIsScrolledPastSearch(window.scrollY > 150);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="app-container">
      <div
        id="header_bar"
        onMouseEnter={() => setShowHoverSearch(true)}
        onMouseLeave={() => setShowHoverSearch(false)}
      >
        <h1 className="page-title">Personal Tracker</h1>
      </div>
      {showHoverSearch && isScrolledPastSearch && (
        <input
          onMouseEnter={() => setShowHoverSearch(true)}
          onMouseLeave={() => setShowHoverSearch(false)}
          type="text"
          value={searchItem}
          onChange={(e) => setSearchItem(e.target.value)}
          placeholder="Type to search"
          className="search-input-fixed"
        />
      )}
      <RecordForm
        templateFilter={templateFilter}
        showForm={showForm}
        setShowForm={setShowForm}
        selectedProject={selectedProject}
        selectedGroup={selectedGroup}
      />
      {!showForm && (
        <>
          <div className="spacer-md" />
          <input
            type="text"
            value={searchItem}
            onChange={(e) => setSearchItem(e.target.value)}
            placeholder="Type to search"
            className="search-input"
          />
          <div className="spacer-md" />
          <hr />
          <div className="spacer-md" />
          <RecordList
            searchItem={searchItem}
            templateFilter={templateFilter}
            showForm={showForm}
            setShowForm={setShowForm}
            onSelectProjectGroup={(project, group) => {
              setSelectedProject(project);
              setSelectedGroup(group);
            }}
          />
        </>
      )}
      <div id="command_bar">
        <IconButtonBar setTemplateFilter={setTemplateFilter} templateFilter={templateFilter} />
      </div>
    </div>
  );
}
