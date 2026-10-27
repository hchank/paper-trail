# Papertrail

A lightweight shared-document workspace built for the Ajaia product-engineering exercise. Create and rename documents, format notes, import text files, and share drafts between demo teammates.

## Run locally

Requirements: Node.js 24+ and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Documents persist in `.data/documents.json` and are seeded on the first run. Set `DATA_DIR` to use a different persistent directory:

```bash
DATA_DIR=/path/to/papertrail-data npm run dev
```

Check the app and its automated test:

```bash
npm run typecheck
npm test
npm run build
```

## Try the product

- **Alex Morgan** is the default account and owns the welcome document. Alex can also open Sam Rivera's shared Q4 brief.
- Use the **Demo account** selector to switch between Alex Morgan, Sam Rivera, and Jordan Lee. No passwords are used; identity is simulated for the exercise.
- Create documents from the sidebar. Rename by editing the document title. Use the toolbar for headings, bold, italic, underline, and ordered or bulleted lists. Changes autosave.
- Use **Share** on an owned document to grant another demo account access. Shared documents appear in the recipient's list and are editable; only the owner can rename, share, or delete.
- Import `.txt` or `.md` files (maximum 1 MB) using the file picker. Each line is imported as editable text; Markdown syntax is preserved as text rather than rendered. The formatted document is also limited to 1 MB, so very newline-dense files may be rejected after conversion.

## Deployment

Build and run with Docker:

```bash
docker build -t papertrail .
docker run --rm -p 3000:3000 -v papertrail-data:/app/.data papertrail
```

Use persistent storage for `/app/.data`: the file store is suitable for a single app instance, not a horizontally scaled deployment. This repository does not yet have a public deployment URL; publishing requires an external hosting account and persistent volume.

## Scope and known limitations

This is a product slice, not production authentication or real-time multi-user editing. Demo account selection is intentionally public. Rich-text content is sanitized on save and load; files are restricted by extension and size. File persistence is single-instance and may need a database, locking strategy, and backups for production. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the tradeoffs and next steps.
