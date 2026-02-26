import Dexie, { type EntityTable } from "dexie";
import type { Session } from "./models";

class HrvDexie extends Dexie {
  sessions!: EntityTable<Session, "id">;

  constructor() {
    super("hrv-trainer-db");
    this.version(1).stores({
      sessions: "id, startedAt, mode",
    });
  }
}

export const db = new HrvDexie();

export async function saveSession(session: Session): Promise<void> {
  await db.sessions.put(session);
}

export async function listSessions(limit = 25): Promise<Session[]> {
  return db.sessions.orderBy("startedAt").reverse().limit(limit).toArray();
}
