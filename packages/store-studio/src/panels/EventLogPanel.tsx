import { useCallback, useEffect, useState } from "react";

import { useProject } from "../data-access-layer/useProject";
import { getHost } from "../data-access-layer/host";
import { isEventRecord, replayLog, type EventLog } from "../model/events";
import { Panel } from "./Panel";

export function EventLogPanel() {
  const project = useProject();
  const [log, setLog] = useState<EventLog | null>(null);
  const [status, setStatus] = useState("");

  const refresh = useCallback(() => {
    void getHost()
      .readEvents()
      .then(setLog)
      .catch(() => setLog(null));
  }, []);
  useEffect(() => {
    refresh();
    return getHost().subscribe((event) => {
      if (event.type === "project-changed") refresh();
    });
  }, [refresh]);

  const events = log?.records.filter(isEventRecord).slice(-8).reverse() ?? [];

  function verify(): void {
    if (log === null) {
      setStatus("No event log yet.");
      return;
    }
    try {
      const replayed = replayLog(log);
      setStatus(
        JSON.stringify(replayed) === JSON.stringify(project)
          ? "In sync — replay reproduces the current document."
          : "Replay differs from the current document.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Replay failed.");
    }
  }

  return (
    <Panel
      id="events"
      title="Events"
      className="event-panel"
      actions={
        <span className="controls">
          <button type="button" onClick={refresh}>
            Refresh
          </button>
          <button type="button" onClick={verify}>
            Verify
          </button>
        </span>
      }
    >
      <p className="hint">
        {log === null
          ? "No edits recorded yet. Changes append to events.jsonl."
          : `${log.records.filter(isEventRecord).length} events · events.jsonl`}
      </p>
      {status === "" ? null : <p className="hint">{status}</p>}
      <div className="event-list">
        {events.map((event) => (
          <div key={event.id} className="event-row">
            <span>#{event.seq}</span>
            <span>{event.label ?? "edit"}</span>
            <small>{event.ts.slice(11, 19)}</small>
          </div>
        ))}
      </div>
    </Panel>
  );
}
