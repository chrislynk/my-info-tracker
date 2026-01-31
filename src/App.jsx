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

  useEffect(() => {
    const handleScroll = () => {
      // Check if scrolled past approximately 150px (header + search input area)
      setIsScrolledPastSearch(window.scrollY > 150);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={{
      maxWidth: 900,
      margin: "0 auto",
      padding: "12px",
      fontFamily: "system-ui"
    }}>
      <div
        id="header_bar"
        onMouseEnter={() => setShowHoverSearch(true)}
        onMouseLeave={() => setShowHoverSearch(false)}
      >
        <h1 style={{ marginTop: 0, fontSize: "clamp(1.5rem, 5vw, 2rem)" }}>Personal Tracker</h1>
      </div>
      {showHoverSearch && isScrolledPastSearch && (
        <input
          onMouseEnter={() => setShowHoverSearch(true)}
          onMouseLeave={() => setShowHoverSearch(false)}
          type="text"
          value={searchItem}
          onChange={(e) => setSearchItem(e.target.value)}
          placeholder="Type to search"
          style={{
            padding: 10,
            fontSize: "16px",
            width: "calc(100% - 24px)",
            maxWidth: 876,
            boxSizing: "border-box",
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1001,
            backgroundColor: "white",
            border: "2px solid #1E96C8",
            borderRadius: 4,
            boxShadow: "0 4px 8px #1E96C8"
          }}
        />
      )}
      <RecordForm templateFilter={templateFilter} showForm={showForm} setShowForm={setShowForm} />
      {!showForm && (
        <>
          <div style={{ height: 16 }} />
          <input
            type="text"
            value={searchItem}
            onChange={(e) => setSearchItem(e.target.value)}
            placeholder="Type to search"
            style={{ padding: 10, fontSize: "16px", width: "100%", boxSizing: "border-box", border: "1px solid #1E96C8", }}
          />
          <div style={{ height: 16 }} />
          <hr />
          <div style={{ height: 16 }} />
          <RecordList searchItem={searchItem} templateFilter={templateFilter} />
        </>
      )}
      <div id="command_bar">
        <IconButtonBar setTemplateFilter={setTemplateFilter} templateFilter={templateFilter} />
      </div>
    </div>
  );
}
