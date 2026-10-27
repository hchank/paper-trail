import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import sanitizeHtml from "sanitize-html";

export const DEMO_USERS = [
  { id: "alex@ajaia.test", name: "Alex Morgan", initials: "AM" },
  { id: "sam@ajaia.test", name: "Sam Rivera", initials: "SR" },
  { id: "jordan@ajaia.test", name: "Jordan Lee", initials: "JL" },
] as const;

export type DemoUser = (typeof DEMO_USERS)[number];

export type DocumentRecord = {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  sharedWith: string[];
  createdAt: string;
  updatedAt: string;
};

type Store = { documents: DocumentRecord[] };

const storageDirectory =
  process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const storageFile = path.join(storageDirectory, "documents.json");
const allowedTags = [
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
];
let mutationQueue = Promise.resolve();

export function sanitizeDocumentHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function htmlFromText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

export function getDemoUser(id: string | null | undefined): DemoUser {
  return DEMO_USERS.find((user) => user.id === id) ?? DEMO_USERS[0];
}

function seedStore(): Store {
  const now = new Date().toISOString();
  return {
    documents: [
      {
        id: "welcome-to-papertrail",
        title: "Welcome to Papertrail",
        content:
          "<h1>A calmer place for shared work</h1><p>This is your workspace. Create a document, import a text file, or share a draft with a teammate.</p><h2>Make it yours</h2><ul><li>Format notes with the toolbar</li><li>Changes save as you type</li><li>Switch demo accounts to explore sharing</li></ul>",
        ownerId: DEMO_USERS[0].id,
        sharedWith: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "product-brief",
        title: "Product brief — Q4",
        content:
          "<h1>Q4 product brief</h1><p><strong>Goal:</strong> help small teams keep decisions and working notes in one easy-to-find place.</p><h2>Open questions</h2><ol><li>Which workflows deserve a dedicated template?</li><li>How should we make ownership and access more visible?</li></ol>",
        ownerId: DEMO_USERS[1].id,
        sharedWith: [DEMO_USERS[0].id],
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(storageFile, "utf8");
    const store: unknown = JSON.parse(raw);
    if (
      typeof store === "object" &&
      store !== null &&
      "documents" in store &&
      Array.isArray(store.documents)
    ) {
      return store as Store;
    }
    throw new Error("Document store has an invalid shape.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const initial = seedStore();
    await writeStore(initial);
    return initial;
  }
}

async function writeStore(store: Store) {
  await mkdir(storageDirectory, { recursive: true });
  const temporaryFile = `${storageFile}.${randomUUID()}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(store, null, 2), "utf8");
  await rename(temporaryFile, storageFile);
}

export async function listDocumentsFor(userId: string) {
  const { documents } = await readStore();
  return documents
    .filter(
      (document) =>
        document.ownerId === userId || document.sharedWith.includes(userId),
    )
    .map((document) => ({
      ...document,
      content: sanitizeDocumentHtml(document.content),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDocument(id: string) {
  const { documents } = await readStore();
  const document = documents.find((item) => item.id === id);
  return document
    ? { ...document, content: sanitizeDocumentHtml(document.content) }
    : null;
}

function mutateStore<T>(mutate: (store: Store) => T) {
  const operation = mutationQueue.then(async () => {
    const store = await readStore();
    const result = mutate(store);
    await writeStore(store);
    return result;
  });
  mutationQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

export async function createDocument(
  ownerId: string,
  title: string,
  content = "",
) {
  return mutateStore((store) => {
    const now = new Date().toISOString();
    const document: DocumentRecord = {
      id: randomUUID(),
      title: title.trim().slice(0, 120) || "Untitled document",
      content: sanitizeDocumentHtml(content),
      ownerId,
      sharedWith: [],
      createdAt: now,
      updatedAt: now,
    };
    store.documents.push(document);
    return document;
  });
}

export async function updateDocument(
  id: string,
  updates: Partial<Pick<DocumentRecord, "title" | "content">>,
) {
  return mutateStore((store) => {
    const document = store.documents.find((item) => item.id === id);
    if (!document) return null;
    if (updates.title !== undefined) {
      document.title =
        updates.title.trim().slice(0, 120) || "Untitled document";
    }
    if (updates.content !== undefined) {
      document.content = sanitizeDocumentHtml(updates.content);
    }
    document.updatedAt = new Date().toISOString();
    return document;
  });
}

export async function shareDocument(id: string, email: string) {
  return mutateStore((store) => {
    const document = store.documents.find((item) => item.id === id);
    if (!document) return null;
    if (!document.sharedWith.includes(email)) document.sharedWith.push(email);
    document.updatedAt = new Date().toISOString();
    return document;
  });
}

export async function deleteDocument(id: string) {
  return mutateStore((store) => {
    const before = store.documents.length;
    store.documents = store.documents.filter((item) => item.id !== id);
    return store.documents.length !== before;
  });
}
