import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

export async function listAllRelationships() {
  const { data } = await client.models.RecordRelationship.list();
  return data;
}

export async function createRelationship(
  sourceRecordId: string,
  targetRecordId: string,
  type: string,
  note?: string
) {
  return client.models.RecordRelationship.create({
    sourceRecordId,
    targetRecordId,
    type,
    note,
  });
}

export async function listRelationshipsForRecord(
  recordId: string
) {
  const { data } =
    await client.models.RecordRelationship.list();

  return data.filter(
    (r) => r.sourceRecordId === recordId
  );
}

export async function listBacklinksForRecord(
  recordId: string
) {
  const { data } =
    await client.models.RecordRelationship.list();

  return data.filter(
    (r) => r.targetRecordId === recordId
  );
}

export async function deleteRelationship(
  relationshipId: string
) {
  return client.models.RecordRelationship.delete({
    id: relationshipId,
  });
}

export const RELATIONSHIP_TYPES = [
  "relates_to",
  "depends_on",
  "blocks",
  "includes",
  "referenced_by",
  "duplicates",
] as const;