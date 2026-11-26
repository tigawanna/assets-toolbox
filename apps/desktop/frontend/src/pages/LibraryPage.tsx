import { PackageCard } from "../components/PackageCard";
import { toolPackages } from "../lib/catalog";

export function LibraryPage() {
  return (
    <div className="tool-grid">
      {toolPackages.map((tool) => (
        <PackageCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
