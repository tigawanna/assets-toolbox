import { ArrowLeft, TriangleAlert } from "lucide-react";

import { ShellLink } from "../components/ShellLink";

export function ErrorPage({
  status = 500,
  message = "This page could not be opened.",
}: {
  status?: number;
  message?: string;
}) {
  return (
    <div className="error-page">
      <span className="error-icon">
        <TriangleAlert size={28} aria-hidden="true" />
      </span>
      <p className="error-code">{status}</p>
      <h1>{message}</h1>
      <ShellLink to="/">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to library
      </ShellLink>
    </div>
  );
}
