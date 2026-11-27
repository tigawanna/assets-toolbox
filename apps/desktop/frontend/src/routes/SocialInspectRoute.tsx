import { useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { InspectorPage } from "@assets/social-inspect/components/InspectorPage";

import { PackageIcon } from "../components/PackageIcon";
import { ToolHeader } from "../components/ToolHeader";

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

  return (
    <>
      <ToolHeader
        icon={<PackageIcon name="scan" size={17} />}
        title="Social Inspect"
        meta="Open Graph · favicons · previews"
        actions={
          <button
            type="button"
            onClick={() =>
              document
                .querySelector<HTMLInputElement>('input[aria-label="URL to inspect"]')
                ?.focus()
            }
          >
            <Search size={13} aria-hidden="true" />
            Inspect URL
          </button>
        }
      />
      <InspectorPage embedded initialUrl={url} onUrlChange={onUrlChange} />
    </>
  );
}
