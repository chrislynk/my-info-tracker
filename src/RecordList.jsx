import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";

const client = generateClient();

function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function RecordList() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const { data, errors } = await client.models.Record.list({
        // you can add sort/filter later
        limit: 100,
      });
      if (errors?.length) throw new Error(errors.map((x) => x.message).join("; "));

      const items = data ?? [];

      const withUrls = await Promise.all(
        items.map(async (r) => {
          if (!r.imageKey) return r;
          try {
            const { url } = await getUrl({ path: r.imageKey });
            return { ...r, imageUrl: url.toString() };
          } catch {
            return r;
          }
        })
      );

      // newest first (createdAt exists in most Amplify models; if not, remove this)
      withUrls.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

      setRecords(withUrls);
    } catch (err) {
      console.error(err);
      alert(`Load failed: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("records:changed", handler);
    return () => window.removeEventListener("records:changed", handler);
  }, []);

  if (loading) return <div>Loading records…</div>;
  if (!records.length) return <div>No records yet.</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {records.map((r) => (
        <div
          key={r.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 700 }}>{r.title}</div>
            <div style={{ fontSize: 12, color: "#555" }}>
              {fmt(r.start)} {r.end ? `→ ${fmt(r.end)}` : ""}
            </div>
          </div>

          {r.imageUrl ? (
            <img
              src={r.imageUrl}
              alt={r.title}
              style={{ maxWidth: 240, borderRadius: 6, border: "1px solid #eee" }}
            />
          ) : null}

          {r.notes ? <div style={{ whiteSpace: "pre-wrap" }}>{r.notes}</div> : null}

          {Array.isArray(r.tags) && r.tags.length ? (
            <div style={{ fontSize: 12, color: "#444" }}>
              Tags: {r.tags.join(", ")}
            </div>
          ) : null}

          <div style={{ fontSize: 12, color: "#444" }}>
            {r.entryKind ? <>Kind: {r.entryKind} · </> : null}
            {r.status ? <>Status: {r.status} · </> : null}
            {r.collection ? <>Collection: {r.collection}</> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
