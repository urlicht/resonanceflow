import type { Session } from "./models";

function triggerDownload(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportSessionJson(session: Session): void {
  const pretty = JSON.stringify(session, null, 2);
  triggerDownload(pretty, `${session.id}.json`, "application/json");
}

export function exportSessionCsv(session: Session): void {
  const lines: string[] = ["t_ms,hr,rr_s"];

  for (const event of session.rawEvents) {
    const rrJoined = event.rr_s?.map((rr) => rr.toFixed(6)).join("|") ?? "";
    lines.push(`${event.t_ms},${event.hr ?? ""},${rrJoined}`);
  }

  triggerDownload(lines.join("\n"), `${session.id}.csv`, "text/csv");
}
