import { ENGINE_VERSION, sessionSchema, type MockSession } from "./contracts";

type Stored = { session: MockSession | null; owner: string; touched: number };
export type Contribution = Pick<
  MockSession,
  | "id"
  | "contributor"
  | "config"
  | "engineVersion"
  | "researchVersion"
  | "picks"
  | "status"
  | "withdrawn"
>;
const KEY = "active";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fhfh-mock-draft", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("sessions"))
        request.result.createObjectStore("sessions");
      if (!request.result.objectStoreNames.contains("outbox"))
        request.result.createObjectStore("outbox");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function storedSession(): Promise<MockSession | null> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("sessions")
        .objectStore("sessions")
        .get(KEY);
      request.onsuccess = () => {
        try {
          const raw = (request.result as Stored | undefined)?.session;
          if (
            raw &&
            (raw.version !== 1 || raw.engineVersion !== ENGINE_VERSION)
          )
            throw new Error(
              "This saved mock uses an older engine. Start a new mock.",
            );
          const session = raw ? sessionSchema.parse(raw) : null;
          if (
            session &&
            (session.config.userSeat >= session.config.teamCount ||
              session.config.bots.length !== session.config.teamCount ||
              new Set(session.picks.map((p) => p.playerId)).size !==
                session.picks.length ||
              session.picks.some(
                (p, i) =>
                  p.pick !== i + 1 ||
                  !session.players.some((v) => v.id === p.playerId),
              ))
          )
            throw new Error(
              "The saved mock is invalid. Take control and start a new mock.",
            );
          resolve(
            session
              ? {
                  ...session,
                  status: session.status === "complete" ? "complete" : "paused",
                }
              : null,
          );
        } catch {
          reject(
            new Error(
              "The saved mock cannot be restored with this engine. Take control and start a new mock.",
            ),
          );
        }
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
/** The owner check and write share a transaction, including explicit takeover. */
export async function writeSession(
  owner: string,
  session: MockSession | null,
  takeover = false,
): Promise<boolean> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["sessions", "outbox"], "readwrite"),
        store = tx.objectStore("sessions"),
        read = store.get(KEY);
      let owned = false;
      read.onsuccess = () => {
        const current = read.result as Stored | undefined;
        if (!current || current.owner === owner || takeover) {
          store.put(
            { owner, session, touched: Date.now() } satisfies Stored,
            KEY,
          );
          owned = true;
          if (
            session?.contributor &&
            (session.picks.length || session.withdrawn)
          ) {
            const {
              id,
              contributor,
              config,
              engineVersion,
              researchVersion,
              picks,
              status,
              withdrawn,
            } = session;
            tx.objectStore("outbox").put(
              {
                id,
                contributor,
                config,
                engineVersion,
                researchVersion,
                picks,
                status,
                withdrawn,
              } satisfies Contribution,
              id,
            );
          }
        }
      };
      tx.oncomplete = () => resolve(owned);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function pendingContributions(
  userId: string,
): Promise<Contribution[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("outbox").objectStore("outbox").getAll();
      r.onsuccess = () =>
        resolve(
          (r.result as Contribution[]).filter((s) => s.contributor === userId),
        );
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function acknowledgeContribution(sent: Contribution) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("outbox", "readwrite"),
        store = tx.objectStore("outbox"),
        r = store.get(sent.id);
      r.onsuccess = () => {
        if (JSON.stringify(r.result) === JSON.stringify(sent))
          store.delete(sent.id);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
