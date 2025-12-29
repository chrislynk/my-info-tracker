import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "images",
  access: (allow) => ({
    // keep it simple for dev: anyone with the API key can read/write
    // tighten later when you add Auth (Cognito)
    "public/*": [allow.guest.to(["read", "write", "delete"])],
  }),
});
