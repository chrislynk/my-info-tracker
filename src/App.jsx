import { uploadData, getUrl } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import RecordForm from "./RecordForm";
import RecordList from "./RecordList";

const client = generateClient();

export default function App() {

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
