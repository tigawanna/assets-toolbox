import { createFileRoute } from "@tanstack/react-router";

import { Studio } from "@/components/studio";

export const Route = createFileRoute("/board/$projectId")({
  component: BoardPage,
});

function BoardPage() {
  const { projectId } = Route.useParams();
  return <Studio projectId={projectId} />;
}
