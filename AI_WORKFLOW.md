# AI workflow note

- **Tool used:** Copilot SDK in VS Code (AI coding assistant).
- **Where it helped:** Quickly mapping the generated React Router starter, scaffolding the first pass of the route/editor and styles, and identifying a small focused test for rich-text sanitization and safe text import.
- **Judgment applied:** I kept the scope to a verifiable single-workspace create/edit/import/share loop rather than attempting real-time collaboration or production auth. I chose local file persistence to keep setup free of third-party accounts. The default framework welcome screen and external font dependency were removed rather than adapted into the product.
- **What is deliberately not represented as production-ready:** The seeded account switcher is a demo identity mechanism, not authentication. JSON storage is for a single instance, not a scaled service. There is no public deployment, Google Drive folder, or recorded walkthrough link in this repository.
- **Verification:** Ran the project typecheck, automated sanitizer/import tests, production build, and local HTTP smoke tests for save, sharing, imports, and access checks. A browser walkthrough caught and fixed an editor save-boundary issue; save-and-refresh persistence was then checked in-browser. These checks do not replace deployment or multi-user usability testing.

AI-generated code was reviewed against the route/action data flow and the server-side access checks. The final claims and known gaps are recorded here and in the architecture note so reviewers can distinguish a working local demo from deployment/auth work that still needs doing.
