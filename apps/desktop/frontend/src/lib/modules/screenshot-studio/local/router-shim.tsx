import { useSyncExternalStore } from "react";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

type NavigateOptions = {
  to: string;
  params?: Record<string, string>;
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

function routeHash(to: string, params?: Record<string, string>): string {
  const path = (to.startsWith("#") ? to.slice(1) : to).split(/[?#]/, 1)[0] ?? "/";
  const absolute = path.startsWith("/") ? path : `/${path}`;
  const resolved = absolute.replace(/\$([A-Za-z0-9_]+)/g, (token, name: string) => {
    const value = params?.[name];
    return value === undefined ? token : encodeURIComponent(value);
  });
  return `#${resolved}`;
}

function projectIdFromHash(hash: string): string | null {
  const route = hash.startsWith("#") ? hash.slice(1) : hash;
  const match = /^\/board\/([^/?#]+)\/?$/.exec(route);
  if (match?.[1] === undefined) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function getCurrentProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return projectIdFromHash(window.location.hash);
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", emit);
}

export async function navigate({ to, params }: NavigateOptions): Promise<void> {
  if (typeof window === "undefined") return;
  const hash = routeHash(to, params);
  if (window.location.hash === hash) {
    emit();
    return;
  }
  window.location.hash = hash;
  // Update immediately; the browser's hashchange event also handles Back/Forward.
  emit();
}

export function useNavigate() {
  return navigate;
}

export function useCurrentProjectId(): string | null {
  return useSyncExternalStore(subscribe, getCurrentProjectId, () => null);
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  params?: Record<string, string>;
  children?: ReactNode;
};

export function Link({ to, params, children, onClick, ...props }: LinkProps) {
  const external = /^[a-z][a-z\d+.-]*:/i.test(to) || to.startsWith("//");
  const href = external ? to : routeHash(to, params);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || external) return;
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (props.target !== undefined && props.target !== "_self") ||
      props.download !== undefined
    ) {
      return;
    }
    event.preventDefault();
    void navigate({ to, params });
  }

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
