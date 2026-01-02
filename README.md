
# Personal Info Tracker

A small, extensible personal record tracker built with React (Vite) and AWS Amplify Gen 2.
It supports creating, editing, and deleting records with optional image attachments, backed by AppSync + DynamoDB and S3.

This project is intentionally simple at v0.x, but structured to scale cleanly.

## Features

- Create records with: Start / End datetime,Title, Notes, Tags, Entry Template, Status, grouping info, and Image attachment.
- Inline editing of records
- Replace attached images safely (S3 cleanup handled)
- Delete records (DynamoDB + S3)
- Hosted frontend via AWS Amplify Hosting
- Backend defined as code using Amplify Gen 2

## Tech Stack 

### Frontend

-   React
-   Vite
-   Plain CSS (no UI framework yet)

### Backend (AWS)

-   AWS Amplify **Gen 2**
-   AppSync (GraphQL)
-   DynamoDB (record storage)
-   S3 (image storage)

### Tooling

-   Node.js **20 LTS**
-   AWS Amplify CLI (`ampx`)
-   GitHub (CI/CD via Amplify Hosting)

* * * * *

Project Structure
-----------------

```.
├── amplify/
│   ├── backend.ts              # Registers backend resources
│   ├── data/
│   │   └── resource.ts         # Record data model (DynamoDB/AppSync)
│   └── storage/
│       └── resource.ts         # S3 storage definition
│
├── src/
│   ├── App.jsx
│   ├── RecordForm.jsx
│   ├── RecordList.jsx
│   ├── main.jsx
│   └── styles.css
│
├── amplify_outputs.json        # Generated backend config (do not edit)
├── index.html
├── vite.config.js
└── package.json`

```

Data Model
----------

**Record** fields:

-   `id` (generated)
-   `start` (datetime)
-   `end` (datetime)
-   `title` (required)
-   `notes`
-   `tags` (string array)
-   `template`
-   `status`
-   `group`
-   `imageKey` (S3 object path)
-   `createdAt`
-   `updatedAt`

* * * * *

Local Development
-----------------

### Prerequisites

-   Node.js **20 LTS**
-   AWS credentials configured\
    (`aws sts get-caller-identity` must succeed)

### Day-to-day workflow

1.  Create a feature branch `git checkout -b feature/add-status-dropdown`
1.  Make changes
    -   Frontend changes in `src/`
    -   Backend changes in `amplify/` (data/storage/auth)
1.  Test locally
    -   Backend: `npx ampx sandbox` (your personal dev backend) [AWS Amplify Documentation+1](https://docs.amplify.aws/react/deploy-and-host/sandbox-environments/setup/?utm_source=chatgpt.com)
    -   Frontend (seperate command window): `npm run dev`
1.  Commit + push
`git add .` & `git commit -m "Add status dropdown"` &
`git push -u origin feature/add-status-dropdown`
1.  Connect the branch in Amplify Console\
    Amplify → your app → **Branch** → connect `feature/add-status-dropdown`.

Amplify will deploy that branch separately (frontend + backend), giving you a preview URL. [AWS Amplify Documentation](https://docs.amplify.aws/react/deploy-and-host/fullstack-branching/branch-deployments/?utm_source=chatgpt.com)

1.  Merge to `main`\
    Once you're happy, merge. Amplify redeploys `main`.

* * * * *

Storage Notes
-------------

-   Images are uploaded to S3 under `public/*`
-   The S3 key is stored on the Record as `imageKey`
-   On image replacement:
    1.  New image is uploaded
    2.  Record is updated
    3.  Old image is deleted

* * * * *

Deployment
----------

Deployment is handled by **AWS Amplify Hosting**.
Amplify builds and deploys automatically.

### Publishing Updates

`git add .` &
`git commit -m "feat: your change"` &
`git push`

Amplify redeploys on push. You can watch this in:
AWS Console → Amplify → Your App → main → Build logs

* * * * *

Environments & Workflow
-----------------------

-   `main` → production
-   `feature/*` → preview deployments (optional)

Amplify Gen 2 supports **full-stack branch deployments**, allowing isolated backends per branch.

* * * * *

Security Note
-------------

Current configuration uses **public API key access** for simplicity.

Suitable for:

-   Personal use
-   Early prototypes

* * * * *

Versioning
----------

This project is currently **pre-1.0**.\
Breaking changes may occur while the data model stabilizes.

* * * * *