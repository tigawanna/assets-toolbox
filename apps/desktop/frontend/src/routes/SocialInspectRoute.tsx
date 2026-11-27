import { useCallback, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { InspectorPage } from "@assets/social-inspect/components/InspectorPage";

import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader, ToolHeaderButton } from "../components/ToolHeader";
import { useProjectDocument } from "../lib/projects/context";

export function SocialInspectRoute() {
  const navigate = useNavigate();
  const { url } = useSearch({ strict: false }) as { url?: string };
  const {
    data: inspectDocument,
    update: updateInspectDocument,
    ready,
  } = useProjectDocument<{ url: string }>("inspect", { url: "" });

  useEffect(() => {
    if (!ready || url || !inspectDocument.url) return;
    void navigate({
      to: ".",
      search: { url: inspectDocument.url },
      replace: true,
    });
  }, [inspectDocument.url, navigate, ready, url]);

  const onUrlChange = useCallback(
    (nextUrl: string) => {
      const trimmed = nextUrl.trim();
      updateInspectDocument({ url: trimmed });
      void navigate({
        to: ".",
        search: trimmed === "" ? {} : { url: trimmed },
        replace: true,
      });
    },
    [navigate, updateInspectDocument],
  );

  return (
    <>
      <ToolHeader
        icon={<PackageIcon name="scan" size={17} />}
        title="Social Inspect"
        meta="Open Graph · favicons · previews"
        actions={
          <ToolHeaderButton
            onClick={() =>
              document
                .querySelector<HTMLInputElement>('input[aria-label="URL to inspect"]')
                ?.focus()
            }
          >
            <Search size={13} aria-hidden="true" />
            Inspect URL
          </ToolHeaderButton>
        }
      />
      <InspectorPage embedded initialUrl={url ?? ""} onUrlChange={onUrlChange} />
    </>
  );
}
