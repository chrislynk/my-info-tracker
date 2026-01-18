import { uploadData, getUrl } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import React, { useState } from "react";
import RecordForm from "./RecordForm";
import RecordList from "./RecordList";
import IconButtonBar from "./IconButtonBar";

const client = generateClient();

export default function App() {
  const [searchItem, setSearchItem] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");

  return (
    <div style={{
      maxWidth: 900,
      margin: "0 auto",
      padding: "12px",
      fontFamily: "system-ui",
      "@media (min-width: 768px)": {
        padding: 24,
        maxWidth: "100%"
      }
    }}>
      <h1 style={{ marginTop: 0, fontSize: "clamp(1.5rem, 5vw, 2rem)" }}>Personal Tracker</h1>
      <RecordForm templateFilter={templateFilter} />
      <div style={{ height: 16 }} />
      <hr />
      <div style={{ height: 16 }} />
      <RecordList searchItem={searchItem} setSearchItem={setSearchItem} templateFilter={templateFilter} />
      <div style={{ position: "sticky", bottom: 8, zIndex: 10, background: "white", padding: "8px 0"}}>
        <IconButtonBar setTemplateFilter={setTemplateFilter} templateFilter={templateFilter} />
      </div>
    </div>
  );
}
