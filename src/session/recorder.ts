import type { RawEvent, Session, SessionDerived, SessionMode, SessionSettings } from "./models";
import { toIso, uid } from "../utils/time";

export class SessionRecorder {
  private readonly startedAtMs: number;
  private readonly sessionId: string;
  private readonly rawEvents: RawEvent[] = [];

  constructor(
    private readonly mode: SessionMode,
    private readonly settings: SessionSettings,
    startedAtMs = Date.now(),
  ) {
    this.startedAtMs = startedAtMs;
    this.sessionId = uid(this.mode);
  }

  addEvent(event: RawEvent): void {
    this.rawEvents.push({
      t_ms: event.t_ms,
      hr: event.hr,
      rr_s: event.rr_s ? [...event.rr_s] : undefined,
    });
  }

  stop(derived: SessionDerived, endedAtMs = Date.now()): Session {
    return {
      id: this.sessionId,
      startedAt: toIso(this.startedAtMs),
      endedAt: toIso(endedAtMs),
      settings: this.settings,
      rawEvents: [...this.rawEvents],
      derived,
      version: 1,
      mode: this.mode,
    };
  }
}
