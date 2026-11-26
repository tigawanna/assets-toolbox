import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { InspectorPage } from "../components/InspectorPage";
import { validateInspectorSearch } from "../inspector-utils";

export const Route = createFileRoute("/")({
  validateSearch: validateInspectorSearch,
  component: StandaloneInspectorPage,
});

function StandaloneInspectorPage() {
  const { url } = Route.useSearch();
  const navigate = useNavigate();

  const handleUrlChange = useCallback(
    (nextUrl: string) => {
      void navigate({ to: "/", search: { url: nextUrl }, replace: true });
    },
    [navigate],
  );

  return <InspectorPage initialUrl={url} onUrlChange={handleUrlChange} />;
}
