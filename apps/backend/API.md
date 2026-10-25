# App API contract

The application represents one shared event. Every signed-in user can read the
whole dashboard, create tasks, assign registered users, and change task status.
Team leads have no additional API permissions in this version. Assignments can
include users from other teams or users who have not joined a team yet.

All routes below require the existing Better Auth session cookie. Native clients
forward `authClient.getCookie()` in the `Cookie` header. Browser clients use
`credentials: 'include'`. Do not send session objects in JSON. The mobile Hono
client already forwards authentication. Add browser origins to
`AUTH_TRUSTED_ORIGINS` on the backend.

Team, task, and media IDs are PostgreSQL UUID strings. Member IDs are Better Auth
user IDs and are opaque strings. The example IDs in early mockups such as
`team_av` and `task_104` are not real IDs. Use the IDs returned by the API.

| Method | Path                       | Success response                           |
| ------ | -------------------------- | ------------------------------------------ |
| GET    | `/api/dashboard`           | 200 with tasks, teams, members, and stats  |
| POST   | `/api/tasks`               | 201 with the saved task                    |
| PATCH  | `/api/tasks/:taskId`       | 200 with the saved task                    |
| POST   | `/api/media`               | 201 with the uploaded photo's metadata     |
| GET    | `/api/media/:mediaId`      | 200 with authenticated image bytes         |
| POST   | `/api/ai`                  | 200 with analysis and the created task     |
| GET    | `/api/tasks`               | 200 with task objects, optionally filtered |
| POST   | `/api/tasks/claim/:taskId` | 200 with the task after claiming a slot    |

## Dashboard

`GET /api/dashboard` takes no body or query parameters. It returns all tasks,
all teams, and all registered users. It excludes emails, passwords, tokens, and
session data. It makes no changes.

- `tasks` contains the task objects described below, newest first.
- `teams` contains `{ id, name, leadIds }`. Leads come from memberships with role
  `lead`.
- `members` contains `{ id, name, teamId }`. A user belongs to at most one team.
  `teamId` is `null` until a membership exists. This change does not add team
  management routes.
- `stats` contains `{ open, inProgress, completed, urgent }`. Status counts cover
  all tasks. `urgent` counts urgent tasks whose status is not `completed`.

The frontend decides when to refetch. No polling or push subscription is required
by this API contract.

## Create a task

Send JSON to `POST /api/tasks`:

```json
{
  "title": "Restock water",
  "description": "Water station is running low",
  "priority": "medium",
  "teamId": null,
  "assigneeIds": [],
  "slots": 2,
  "location": "Main lobby"
}
```

`title` and `priority` are required. Use a real dashboard team ID to target a team.
Omitted `description` defaults to an empty string. Omitted `teamId` and `location`
default to `null`. Omitted `assigneeIds` defaults to an empty array. Omitted `slots`
defaults to 1. Tasks always start with status `open`.

- Priority is `low`, `medium`, `high`, or `urgent`.
- Status is `open`, `in_progress`, or `completed`.
- Slots are an integer from 1 to 100. They represent total assignment capacity.
- Assignee IDs must identify registered users, be unique, and fit within slots.
- `teamId` may be null. A provided team ID must identify an existing team.
- Title is limited to 200 characters, description to 10,000, and location to 500.
  Text fields are trimmed.

Creation and updates return a task object containing `id`, `title`, `description`,
`priority`, `status`, `teamId`, `assigneeIds`, `slots`, `location`, and `createdAt`.
`createdAt` is an ISO UTC timestamp. The API uses `assigneeIds`, replacing the
original single `assigneeId` proposal.

## Update a task

Send JSON to `PATCH /api/tasks/:taskId` with `status`, `assigneeIds`, or both:

```json
{
  "status": "in_progress",
  "assigneeIds": []
}
```

An omitted field stays unchanged. An empty assignment array clears all
assignments. A nonempty array replaces the entire assignment list. `null` is not
an assignment list. All three statuses may transition to each other. Updating
status does not change assignments automatically.

Title, description, priority, team, location, and slots are not editable through
this route yet. Unknown fields and empty updates return 400. Updates are atomic.
If assignment validation fails, the status and assignments stay unchanged.

## Upload and retrieve a photo

Send `multipart/form-data` to `POST /api/media` with:

| Field    | Type                                     | Required |
| -------- | ---------------------------------------- | -------- |
| `file`   | A single JPEG, PNG, or WebP file         | Yes      |
| `taskId` | An existing task ID to link the photo to | No       |

Do not manually set the multipart `Content-Type` when using `FormData`; the
client must supply its boundary. The per-photo limit is 10 MiB. The backend
checks the declared MIME type and file signature. Empty files, repeated file
fields, and unsupported image types are rejected. HEIC, SVG, audio, and video
are not supported. Convert HEIC photos to JPEG before uploading.

The 201 response contains `{ id, url, contentType, size, taskId }`. `size` is in
bytes. `taskId` is null when omitted. `url` is an API-relative path such as
`/api/media/<id>`. Resolve it against the backend origin, and use the same session
cookie when retrieving it. Browser images can use the cookie jar. Native image
requests must include the cookie header or fetch the image through the
authenticated client.

To analyze images, send the files directly to `POST /api/ai` as described below.
Uploading here with `taskId` persists that association, but the dashboard does not include photo listings.
There is no media listing, deletion, or later attachment endpoint in this version.
Keep the upload response in UI state when displaying a newly uploaded image.

Photo bytes are stored in Neon Postgres for this MVP. This needs no storage
credentials or local disk. Larger deployments can move bytes to object storage
while preserving these routes. Downloads require a session and use private,
no-store caching.

## Analyze a report with images

Send `multipart/form-data` to `POST /api/ai` with:

| Field    | Type                                                    | Required |
| -------- | ------------------------------------------------------- | -------- |
| `source` | Nonempty string, up to 50 characters, such as `glasses` | Yes      |
| `text`   | Report text, up to 10,000 characters                    | No       |
| `images` | JPEG, PNG, or WebP files, up to 10                      | No       |

Repeat the `images` field for multiple files. Provide text, images, or both.
The combined image size limit is 10 MiB. The multipart body limit adds 64 KiB
for text and form overhead. Files must be nonempty and have matching MIME types
and signatures, as with photo uploads. Let the client set the multipart boundary.
JSON bodies and `mediaIds` are no longer accepted.

The backend sends the text and image bytes together to Gemini. It requires
`GEMINI_API_KEY`. On success, it returns `{ processed: true, analysis, tasks }`,
where `tasks` contains one new, unassigned task for staff review. The backend
saves the report in the activity log before calling Gemini, then updates that
record with the analysis and task ID. If processing fails, the report remains
with no task, decision, or action. Uploaded photos are stored against the task
on success. Image-only reports use a default instruction to analyze the event scene.

## Existing task helpers

`GET /api/tasks` returns the same task objects as the dashboard. Optional query
parameters are `teamId=<uuid>` and `claimedBy=me`. They can be combined. The
latter filters to tasks assigned to the signed-in user.

`POST /api/tasks/claim/:taskId` adds the signed-in user to an available slot.
Repeating a successful claim returns the saved task without adding a second
assignment. Claim and PATCH requests serialize against the same task row, so
concurrent requests cannot exceed capacity. Any signed-in user can claim a task.

The old `/api/tasks/new` placeholder is replaced by `POST /api/tasks`.

## Errors

Errors return JSON with an `error` string. Request validation errors also include
`details.formErrors` and `details.fieldErrors`.

| Status | Meaning                                                                    |
| ------ | -------------------------------------------------------------------------- |
| 400    | Malformed JSON, invalid fields or IDs, unknown team or assignee            |
| 401    | Missing or invalid session                                                 |
| 403    | Untrusted browser origin on a mutation                                     |
| 404    | Task or photo not found                                                    |
| 409    | Assignment list exceeds capacity or no claim slots remain                  |
| 413    | Photo exceeds 10 MiB or multipart body exceeds 10 MiB plus 64 KiB overhead |
| 415    | Unsupported photo format or MIME type does not match file signature        |
| 500    | Unexpected server failure, with internal details omitted                   |

## Migration and verification

Run `pnpm --filter backend db:migrate` before starting the updated backend.
Migration 0004 preserves the existing database `assignment` column as the API's
`title`. It adds description, location, creation time, and photo storage. Legacy
`pending` tasks become `open`. Slot counts become at least 1 and at least the
existing assignment count. Older tasks receive the migration time as their
creation time because their historical creation time was not recorded.

Memberships now have a unique user index. If another database already has users
in multiple teams, migration fails instead of discarding memberships. Resolve
those memberships before retrying.

`pnpm --filter backend test` runs session, migration, seed, and API integration
tests against the configured development database. API tests create disposable
records and clean them up. `pnpm --filter backend build` emits declarations for
the existing mobile Hono client.
