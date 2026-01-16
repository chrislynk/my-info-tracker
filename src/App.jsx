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
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>Personal Tracker</h1>
      <RecordForm templateFilter={templateFilter} />
      <div style={{ height: 24 }} />
      <hr />
      <div style={{ height: 24 }} />
      <RecordList searchItem={searchItem} setSearchItem={setSearchItem} templateFilter={templateFilter} />
      <div style={{ position: "sticky", bottom: 8, zIndex: 10, background: "white"}}>
        <IconButtonBar setTemplateFilter={setTemplateFilter} templateFilter={templateFilter} />
      </div>
    </div>
  );
}
