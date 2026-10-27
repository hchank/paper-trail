import { useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  data,
  redirect,
  useFetcher,
} from "react-router";
import type { Route } from "./+types/home";
import {
  createDocument,
  deleteDocument,
  DEMO_USERS,
  getDemoUser,
  getDocument,
  htmlFromText,
  listDocumentsFor,
  shareDocument,
  updateDocument,
} from "../lib/documents.server";

const USER_COOKIE = "ajaia_demo_user";
const MAX_UPLOAD_BYTES = 1024 * 1024;
const MAX_DOCUMENT_BYTES = 1024 * 1024;
const allowedUploadExtensions = [".txt", ".md"];

function getUserId(request: Request) {
  const cookie = request.headers.get("Cookie") ?? "";
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${USER_COOKIE}=`))
    ?.slice(USER_COOKIE.length + 1);
  try {
    return getDemoUser(value ? decodeURIComponent(value) : null).id;
  } catch {
    return getDemoUser(null).id;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = getDemoUser(getUserId(request));
  const documents = await listDocumentsFor(user.id);
  const selectedId = new URL(request.url).searchParams.get("doc");
  const selected =
    documents.find((document) => document.id === selectedId) ??
    documents[0] ??
    null;
  return { user, users: DEMO_USERS, documents, selected };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const userId = getUserId(request);
  const documentId = String(formData.get("documentId") ?? "");

  if (intent === "switch-user") {
    const user = DEMO_USERS.find(
      (candidate) => candidate.id === formData.get("userId"),
    );
    if (!user) return { error: "Choose one of the demo accounts." };
    return redirect("/", {
      headers: {
        "Set-Cookie": `${USER_COOKIE}=${encodeURIComponent(user.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
      },
    });
  }

  if (intent === "create") {
    const document = await createDocument(userId, "Untitled document");
    return redirect(`/?doc=${document.id}`);
  }

  if (intent === "import") {
    const upload = formData.get("file");
    if (!(upload instanceof File) || upload.size === 0) {
      return { error: "Choose a .txt or .md file to import." };
    }
    if (upload.size > MAX_UPLOAD_BYTES) {
      return { error: "Files must be 1 MB or smaller." };
    }
    const filename = upload.name.toLowerCase();
    if (!allowedUploadExtensions.some((extension) => filename.endsWith(extension))) {
      return { error: "Only .txt and .md files are supported." };
    }
    const text = await upload.text();
    const title = upload.name.replace(/\.(txt|md)$/i, "").slice(0, 120);
    const content = htmlFromText(text);
    if (Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES) {
      return { error: "Imported content must fit within 1 MB after formatting." };
    }
    const document = await createDocument(userId, title, content);
    return redirect(`/?doc=${document.id}`);
  }

  const document = await getDocument(documentId);
  if (!document) return { error: "That document no longer exists." };
  const canEdit =
    document.ownerId === userId || document.sharedWith.includes(userId);
  if (!canEdit) {
    return { error: "You don’t have access to that document." };
  }

  if (intent === "save") {
    const content = formData.get("content");
    if (
      typeof content !== "string" ||
      Buffer.byteLength(content, "utf8") > MAX_DOCUMENT_BYTES
    ) {
      return { error: "Document content must fit within 1 MB." };
    }
    await updateDocument(document.id, { content });
    return { saved: true };
  }

  if (intent === "rename") {
    if (document.ownerId !== userId) {
      return { error: "Only the owner can rename this document." };
    }
    const title = String(formData.get("title") ?? "").trim();
    if (!title || title.length > 120) {
      return { error: "Use a title between 1 and 120 characters." };
    }
    await updateDocument(document.id, { title });
    return { renamed: true };
  }

  if (intent === "share") {
    if (document.ownerId !== userId) {
      return { error: "Only the owner can share this document." };
    }
    const email = String(formData.get("email") ?? "");
    if (
      !DEMO_USERS.some((candidate) => candidate.id === email) ||
      email === userId
    ) {
      return { error: "Choose another demo account to share with." };
    }
    await shareDocument(document.id, email);
    return { shared: true };
  }

  if (intent === "delete") {
    if (document.ownerId !== userId) {
      return { error: "Only the owner can delete this document." };
    }
    await deleteDocument(document.id);
    return redirect("/");
  }

  return data({ error: "Unsupported document action." }, { status: 400 });
}

export function meta() {
  return [
    { title: "Papertrail — team documents" },
    {
      name: "description",
      content: "A calm, lightweight workspace for shared documents.",
    },
  ];
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const { user, users, documents, selected } = loaderData;
  const isOwner = selected?.ownerId === user.id;
  const sharedUsers = users.filter((candidate) =>
    selected?.sharedWith.includes(candidate.id),
  );

  return (
    <main className="workspace">
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="Papertrail home">
          <span className="brand-mark">p.</span>
          <span>papertrail</span>
        </Link>

        <Form method="post" className="new-document-form">
          <input type="hidden" name="intent" value="create" />
          <button className="new-document" type="submit">
            <span aria-hidden="true">＋</span> New document
          </button>
        </Form>
        <Form
          method="post"
          encType="multipart/form-data"
          className="import-form"
        >
          <input type="hidden" name="intent" value="import" />
          <label htmlFor="import-file" className="import-label">
            <span aria-hidden="true">↑</span> Import a file
            <input
              id="import-file"
              name="file"
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              required
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            />
          </label>
          <span className="import-hint">.txt or .md · up to 1 MB</span>
        </Form>

        <div className="side-label">YOUR WORKSPACE</div>
        <nav className="document-list" aria-label="Documents">
          {documents.length === 0 && (
            <p className="empty-sidebar">No documents yet. Start with a new one.</p>
          )}
          {documents.map((document) => {
            const isShared = document.ownerId !== user.id;
            const isSelected = document.id === selected?.id;
            return (
              <Link
                key={document.id}
                className={`document-link${isSelected ? " selected" : ""}`}
                to={`/?doc=${document.id}`}
              >
                <span className="document-icon" aria-hidden="true">
                  ▤
                </span>
                <span className="document-link-copy">
                  <span className="document-link-title">{document.title}</span>
                  <span className="document-link-meta">
                    {isShared ? "Shared with you" : "Owned by you"}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="side-label">DEMO ACCOUNT</span>
          <Form method="post" className="account-form">
            <input type="hidden" name="intent" value="switch-user" />
            <label className="sr-only" htmlFor="demo-user">
              Switch demo account
            </label>
            <select id="demo-user" name="userId" value={user.id} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
              {users.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </Form>
          <p>Demo accounts simulate identity; no password required.</p>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <span>{selected?.title ?? "Untitled"}</span>
          </div>
          <div className="topbar-right">
            {selected && (
              <div className="avatar-stack" aria-label="Document collaborators">
                <span className="avatar" title={user.name}>
                  {user.initials}
                </span>
                {sharedUsers.map((sharedUser) => (
                  <span className="avatar avatar-shared" key={sharedUser.id} title={sharedUser.name}>
                    {sharedUser.initials}
                  </span>
                ))}
              </div>
            )}
            {selected && isOwner && (
              <details className="share-menu">
                <summary className="share-button">Share</summary>
                <div className="share-popover">
                  <strong>Share this document</strong>
                  <p>Invite a demo teammate to view and edit.</p>
                  <ShareForm
                    documentId={selected.id}
                    users={users.filter(
                      (candidate) =>
                        candidate.id !== user.id &&
                        !selected.sharedWith.includes(candidate.id),
                    )}
                  />
                  {sharedUsers.length > 0 && (
                    <div className="shared-list">
                      <span className="side-label">HAS ACCESS</span>
                      {sharedUsers.map((sharedUser) => (
                        <span key={sharedUser.id}>{sharedUser.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </header>

        {actionData?.error && (
          <p className="notice error-notice" role="alert">
            {actionData.error}
          </p>
        )}

        {selected ? (
          <DocumentEditor
            key={selected.id}
            document={selected}
            isOwner={isOwner}
            userName={user.name}
            users={users}
          />
        ) : (
          <div className="welcome-empty">
            <span className="empty-icon">✳</span>
            <h1>A fresh page awaits.</h1>
            <p>Create a document or switch to another demo account.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function ShareForm({
  documentId,
  users,
}: {
  documentId: string;
  users: readonly (typeof DEMO_USERS)[number][];
}) {
  if (users.length === 0) {
    return <p className="muted-copy">Everyone in the demo workspace already has access.</p>;
  }
  return (
    <Form method="post" className="share-form">
      <input type="hidden" name="intent" value="share" />
      <input type="hidden" name="documentId" value={documentId} />
      <label className="sr-only" htmlFor="share-email">
        Choose teammate
      </label>
      <select id="share-email" name="email">
        {users.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>
      <button type="submit">Invite</button>
    </Form>
  );
}

function DocumentEditor({
  document,
  isOwner,
  userName,
  users,
}: {
  document: {
    id: string;
    title: string;
    content: string;
    ownerId: string;
    updatedAt: string;
  };
  isOwner: boolean;
  userName: string;
  users: readonly (typeof DEMO_USERS)[number][];
}) {
  const fetcher = useFetcher();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [title, setTitle] = useState(document.title);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function scheduleSave(editor: HTMLElement) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSavedAt("Saving…");
    saveTimer.current = setTimeout(() => {
      saveContent(editor);
    }, 700);
  }

  function saveContent(editor: HTMLElement) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSavedAt("Saving…");
    fetcher.submit(
      {
        intent: "save",
        documentId: document.id,
        content: editor.innerHTML,
      },
      { method: "post" },
    );
  }

  function format(command: string, value?: string) {
    window.document.execCommand(command, false, value);
    const editor = window.document.querySelector<HTMLDivElement>(".editor-content");
    if (editor) {
      editor.focus();
      scheduleSave(editor);
    }
  }

  const saving = fetcher.state !== "idle";

  return (
    <div className="document-area">
      <div className="editor-heading">
        <div className="title-line">
          {isOwner ? (
            <Form method="post" className="rename-form">
              <input type="hidden" name="intent" value="rename" />
              <input type="hidden" name="documentId" value={document.id} />
              <label className="sr-only" htmlFor={`title-${document.id}`}>
                Document title
              </label>
              <input
                id={`title-${document.id}`}
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={(event) => {
                  if (event.currentTarget.value.trim() && event.currentTarget.value !== document.title) {
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={120}
                className="document-title"
              />
            </Form>
          ) : (
            <h1 className="document-title readonly-title">{document.title}</h1>
          )}
          <div className="document-status">{isOwner ? "Private to you" : `Shared by ${users.find((candidate) => candidate.id === document.ownerId)?.name ?? "teammate"}`}</div>
        </div>
        {isOwner && (
          <Form
            method="post"
            className="delete-form"
            onSubmit={(event) => {
              if (!window.confirm("Delete this document? This cannot be undone.")) event.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="documentId" value={document.id} />
            <button type="submit" className="icon-button" aria-label="Delete document" title="Delete document">
              ⋯
            </button>
          </Form>
        )}
      </div>

      <div className="toolbar" role="toolbar" aria-label="Text formatting">
        <select
          aria-label="Text style"
          defaultValue="p"
          onChange={(event) => format("formatBlock", event.currentTarget.value)}
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <span className="toolbar-divider" />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format("bold")}
          aria-label="Bold"
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format("italic")}
          aria-label="Italic"
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format("underline")}
          aria-label="Underline"
          title="Underline"
        >
          <u>U</u>
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format("insertUnorderedList")}
          aria-label="Bulleted list"
          title="Bulleted list"
        >
          •≡
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format("insertOrderedList")}
          aria-label="Numbered list"
          title="Numbered list"
        >
          1≡
        </button>
        <span className="toolbar-spacer" />
        <span className="editor-save-indicator" role="status">
          {saving
            ? "Saving…"
            : fetcher.data?.error
              ? "Save failed"
              : fetcher.data?.saved
                ? "All changes saved"
                : savedAt || "Autosave on"}
        </span>
      </div>
      {fetcher.data?.error && (
        <p className="save-error" role="alert">{fetcher.data.error}</p>
      )}

      <article
        className="editor-page"
        aria-label="Document editor"
      >
        <div
          className="editor-content"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={`Document content edited by ${userName}`}
          aria-multiline="true"
          spellCheck
          onInput={(event) => scheduleSave(event.currentTarget)}
          onBlur={(event) => saveContent(event.currentTarget)}
          dangerouslySetInnerHTML={{ __html: document.content }}
        />
        <div className="page-footer">
          <span>Papertrail</span>
          <span>Auto-save is on · {userName}</span>
        </div>
      </article>
    </div>
  );
}
