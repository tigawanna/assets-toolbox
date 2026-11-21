import { Panel } from "./Panel";
import { useProject } from "../data-access-layer/useProject";
import { lintProject } from "../lint/rules";
import { useSelection } from "../session/selection";
import { useView } from "../session/view";

export function LintPanel() {
  const project = useProject();
  const { setActiveBoard } = useView();
  const { select } = useSelection();
  const issues = lintProject(project);
  return (
    <Panel
      id="lint"
      title="Lint"
      className="lint-panel"
      actions={
        <span
          className={issues.some((issue) => issue.severity === "error") ? "count error" : "count"}
        >
          {issues.length}
        </span>
      }
    >
      {issues.length === 0 ? <p className="hint">Everything looks good.</p> : null}
      {issues.map((issue) => (
        <button
          key={issue.id}
          type="button"
          className={`lint-row ${issue.severity}`}
          onClick={() => {
            if (issue.boardId !== undefined) setActiveBoard(issue.boardId);
            if (issue.nodeId !== undefined) select(issue.nodeId);
          }}
        >
          <span className="lint-dot" />
          <span>{issue.message}</span>
        </button>
      ))}
    </Panel>
  );
}
