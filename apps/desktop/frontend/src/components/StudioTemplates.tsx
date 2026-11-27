import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import {
  applyStudioTemplate,
  listStudioTemplates,
  removeStudioTemplate,
  saveStudioTemplate,
} from "../lib/studio-templates";
import type { TemplateRecord } from "../lib/templates/types";
import type { StudioSnapshot } from "@assets/screenshot-studio/lib/studio";
import { ToolHeaderButton } from "./ToolHeader";

export function StudioTemplates({ projectId }: { projectId: string }) {
  const [templates, setTemplates] = useState<Array<TemplateRecord<StudioSnapshot>>>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(() => {
    void listStudioTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await saveStudioTemplate(projectId, trimmed);
      setName("");
      setMessage(`Saved “${trimmed}” as a global Studio template.`);
      refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save the template.");
    }
  }, [name, projectId, refresh]);

  const apply = useCallback(
    async (template: TemplateRecord<StudioSnapshot>) => {
      try {
        await applyStudioTemplate(projectId, template.id);
        setMessage(`Applied “${template.name}” to this project's Studio board.`);
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "Could not apply the template.");
      }
    },
    [projectId],
  );

  return (
    <section className="studio-templates">
      <div className="studio-templates-head">
        <h2>Studio templates</h2>
        <p>Global layouts you can reuse in any project.</p>
      </div>
      <div className="studio-templates-create">
        <input
          aria-label="Studio template name"
          value={name}
          placeholder="Save current Studio board as…"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <ToolHeaderButton variant="primary" disabled={!name.trim()} onClick={() => void save()}>
          Save template
        </ToolHeaderButton>
      </div>
      {message ? <p className="studio-templates-message">{message}</p> : null}
      {templates.length === 0 ? (
        <p className="studio-templates-empty">No saved Studio templates yet.</p>
      ) : (
        <div className="studio-templates-list">
          {templates.map((template) => (
            <article className="studio-templates-row" key={template.id}>
              <div className="studio-templates-copy">
                <strong>{template.name}</strong>
                <span>{template.description}</span>
              </div>
              <ToolHeaderButton onClick={() => void apply(template)}>Apply</ToolHeaderButton>
              <ToolHeaderButton
                variant="icon"
                aria-label={`Delete template ${template.name}`}
                onClick={() => void removeStudioTemplate(template.id).then(refresh)}
              >
                <Trash2 size={13} />
              </ToolHeaderButton>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
