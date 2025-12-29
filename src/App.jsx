import { useEffect, useState } from "react";
import { uploadData, getUrl } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import RecordForm from "./RecordForm";
import RecordList from "./RecordList";

const client = generateClient();

export default function App() {
  const [records, setRecords] = useState([]);
  const [file, setFile] = useState(null);

  async function uploadAndCreate() {
    if (!file) return;

    // 1) Upload to S3
    const key = `public/${crypto.randomUUID()}-${file.name}`;

    await uploadData({
      path: key,
      data: file,
      options: { contentType: file.type },
    }).result;

    // 2) Create DB record with imageKey
    await client.models.Record.create({
      title: "Record with image",
      imageKey: key,
    });

    setFile(null);
    loadRecords();
  }

  async function loadRecords() {
    const { data } = await client.models.Record.list();

    // 3) Resolve image URLs
    const withUrls = await Promise.all(
      data.map(async (r) => {
        if (!r.imageKey) return r;
        const { url } = await getUrl({ path: r.imageKey });
        return { ...r, imageUrl: url.toString() };
      })
    );

    setRecords(withUrls);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  return (
    
    
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>Personal Tracker</h1>

      <RecordForm />

      <div style={{ height: 24 }} />
      <hr />
      <div style={{ height: 24 }} />

      <RecordList />
      
    </div>
  );
}
