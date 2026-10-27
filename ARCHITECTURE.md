# Architecture and product choices

## What this slice prioritizes

Papertrail focuses on the core loop reviewers can exercise quickly: create a draft, edit it with basic rich text, refresh and reopen it, then grant a teammate access and switch accounts to verify the shared view. The workspace makes ownership visible and keeps the editor focused on the page.

## Implementation

- **React Router Framework Mode** provides server-rendered route data and server-only actions in `app/routes/home.tsx`.
- **File-backed JSON persistence** lives in `app/lib/documents.server.ts`. Writes use a temporary file followed by rename, and in-process mutations are serialized to reduce lost writes. `DATA_DIR` can point at a persistent volume.
- **Demo identity and sharing** use three seeded accounts. Each action checks document ownership or membership before allowing changes. This demonstrates access behavior but is not a substitute for authentication.
- **Rich text** uses the browser's content-editable surface and basic formatting commands. Saved HTML is allow-listed and sanitized on input and output with `sanitize-html`. Imported text is HTML-escaped before it becomes document content.
- **Imports** accept `.txt` and `.md` files up to 1 MB. Each source line becomes editable text; markdown is intentionally not parsed, avoiding an extra conversion dependency in this scope.

## Tradeoffs and next steps

The JSON store is intentionally easy to run without paid services, but is limited to one app instance and is not a database transaction system. Production work should replace it with SQLite or a managed relational database, add authenticated accounts and durable sharing invitations, and test concurrent updates across instances. Real-time presence, conflict resolution/version history, DOCX/PDF support, and a richer editor were deprioritized in favor of a complete create-edit-share flow.

The repository includes a Docker build and instructions to mount persistent storage. It does not include a live deployment: publishing requires an external hosting account and a persistent volume.
