# Research: Delete Source Documents

## 1. One endpoint for both single and bulk delete

**Decision**: A single backend endpoint, `POST /api/sources/delete`, accepting `{"ids": [...]}`
(always an array, even for a single document), serves both User Story 1 (single delete) and User
Story 2 (bulk delete). The frontend's single-row delete action simply calls it with a one-element
array.

**Rationale**: The two stories differ only in how many ids the user selects before triggering
delete — the backend operation (validate each id, attempt removal, report per-id outcome) is
identical either way. A second `DELETE /api/sources/{id}` endpoint would duplicate the same logic
for no behavioral gain, and using `DELETE` with a request body is inconsistent across HTTP
clients/fetch. One endpoint keeps the API surface minimal, consistent with constitution Principle
III (Single-User Simplicity / YAGNI).

**Alternatives considered**:
- `DELETE /api/sources/{id}` for single + a separate bulk endpoint: rejected — two code paths for
  one operation, more surface to test.
- `DELETE /api/sources` with a JSON body listing ids: rejected — sending a body with `DELETE` is
  poorly and inconsistently supported (some `fetch` polyfills/proxies strip it), while `POST` has
  no such ambiguity.

## 2. Response shape: always 200, per-id outcome in the body

**Decision**: `POST /api/sources/delete` always returns `200 OK` with
`{"results": [DeletionResult, ...]}`, one `DeletionResult` per requested id:
`{"id": str, "status": "deleted" | "failed", "reason": str | null}`. A file that is already absent
from disk (FR-006) is reported as `status: "deleted"`, not as an error.

**Rationale**: This mirrors the existing convention already established by `POST /api/sources`
(upload), whose contract (`002-persist-pdf-sources/contracts/sources-api.md`) explicitly returns
`200` with per-file `rejections` rather than an HTTP error status for expected per-item failure
modes. Reusing the same convention keeps the two write endpoints consistent and lets the frontend
handle both with the same "read the body, don't branch on status" pattern.

**Alternatives considered**:
- `207 Multi-Status` for partial success: rejected — unusual for this codebase, and the existing
  upload endpoint already established the "200 + per-item body" pattern; introducing a different
  convention for a very similar operation would be inconsistent for no real benefit.
- `404` when a target file doesn't exist: rejected — FR-006 explicitly requires treating this as
  success from the user's perspective, not an error to branch on.

## 3. Path-safety validation for the `id` (filename)

**Decision**: Before attempting deletion, reject any id that contains a path separator (`/` or
`\`) or whose resolved path does not stay inside `PDFS_DIR`, returning
`{"status": "failed", "reason": "invalid id"}` for that id without touching the filesystem.

**Rationale**: `id` is a client-supplied string used to build a filesystem path
(`PDFS_DIR / id`). Every `id` the frontend ever sends comes from a prior `GET`/`POST` response
(plain on-disk filenames, collision-suffixed by `resolve_collision_name` in 002 — never containing
a path separator), but the endpoint itself must not trust that a request body is well-formed
before writing/deleting files at an OS-resolved path — the same class of check that prevents any
path-traversal write outside the intended directory. This is a small, self-contained guard, not a
new architectural concept: same YAGNI spirit as the rest of the `sources` module.

**Alternatives considered**: Trusting the id as-is (no validation): rejected — would allow a
crafted `id` like `../../etc/passwd` to attempt deletion outside `PDFS_DIR`, an unacceptable
correctness/security gap regardless of how unlikely a malicious client is for a local single-user
tool.

## 4. Confirmation UI

**Decision**: Use the browser's native `window.confirm()` for the required confirmation step
(FR-002), showing the document name (single) or count (bulk) in the message.

**Rationale**: No modal/dialog component exists anywhere in the frontend today (`grep` across
`frontend/src` for a dialog/modal pattern found none), and this app has no UI component library
beyond Tailwind utility classes. Introducing one just for this confirmation would be scope creep
for a single-user local tool (Principle III). The native `confirm()` blocks the calling code until
answered, which maps directly and simply onto "user confirms before the delete proceeds."

**Alternatives considered**: A custom inline confirm affordance (e.g., "Really delete? [Yes] [No]"
replacing the button) or a proper modal component: rejected for this iteration — real usability
upgrades, but not required by any FR, and would need new shared UI infrastructure this codebase
doesn't have yet.

## 5. Selection state for bulk delete

**Decision**: Selection (which document ids are checked for bulk delete) is local `useState` in
`DocumentList`, not lifted into `useSourceDocuments`. `DocumentList` calls an `onDeleteDocuments(ids:
string[])` callback prop (backed by the hook's new `deleteDocuments`) and clears its own selection
once the call resolves.

**Rationale**: Selection is pure UI state with no meaning outside this one component's lifetime —
it doesn't need to be shared, tested independently of the list, or survive a re-render triggered by
something else. Keeping it local avoids widening `useSourceDocuments`'s public surface for
something that isn't data.

**Alternatives considered**: Lifting selection into the hook: rejected — would couple UI-only state
into the data-fetching hook for no reuse benefit; nothing else needs to read "which rows are
checked."

## 6. Row-level delete is disabled for non-"processed" documents

**Decision**: Reuse the existing `SourceDocument.status` field — the delete affordance (checkbox
and delete button) only renders/enables for `status === 'processed'` — to satisfy FR-007, rather
than inventing a new "is this a real server-confirmed id" flag.

**Rationale**: `useSourceDocuments.ts` already marks upload-in-flight placeholders with
`status: 'processing'` and a `pending:`-prefixed synthetic id (not a real on-disk filename) until
the server confirms them. `status === 'processed'` is already the exact signal "this id is a real,
server-confirmed filename," so no new field is needed.

**Alternatives considered**: Checking for the `pending:` id prefix directly: rejected — it's an
implementation detail of the upload placeholder mechanism; `status` is the field the UI is already
meant to key off of.
