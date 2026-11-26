import { useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { InspectorPage } from "@assets/social-inspect/components/InspectorPage";

export function SocialInspectRoute() {
  const navigate = useNavigate();
  const { url } = useSearch({ from: "/packages/social-inspect" });
  const onUrlChange = useCallback(
    (nextUrl: string) => {
      const trimmed = nextUrl.trim();
      void navigate({
        to: "/packages/social-inspect",
        search: trimmed === "" ? {} : { url: trimmed },
        replace: true,
      });
    },
    [navigate],
  );

  return <InspectorPage embedded initialUrl={url} onUrlChange={onUrlChange} />;
}
