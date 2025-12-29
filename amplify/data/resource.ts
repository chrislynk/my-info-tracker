import { a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  Record: a
    .model({
      start: a.datetime(),
      end: a.datetime(),
      title: a.string().required(),
      notes: a.string(),
      tags: a.string().array(),
      template: a.string(),
      status: a.string(),
      grouping: a.string(),
      imageKey: a.string(), // S3 key for uploaded image
    })
    // For initial dev you can allow public access; tighten later with auth rules
    .authorization((allow) => [allow.publicApiKey()]),
});

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});