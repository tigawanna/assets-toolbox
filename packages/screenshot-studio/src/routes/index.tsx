import { createFileRoute } from "@tanstack/react-router";

import { ProjectHome } from "@/components/project-home";

export const Route = createFileRoute("/")({
  component: ProjectHome,
});
