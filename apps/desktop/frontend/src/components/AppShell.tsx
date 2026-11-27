import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Braces, CircleHelp, LayoutGrid, List, Moon, PanelLeft, Sun } from "lucide-react";
import { Link, useBlocker, useLocation } from "@tanstack/react-router";

import { findPackage, toolPackages } from "../lib/catalog";
import { useDesktopFlush, useFlushRegistry } from "../lib/flush";
import { getActiveProjectId } from "../lib/projects/client";
import { hasSeenTour } from "../lib/tour";
import { registerMcpBridge } from "../lib/mcp";
import { setDesktopModuleActive } from "../lib/desktop";
import { formatPlatform, getSystemInfo, type NativeSystemInfo } from "../lib/native";
import { toggleTheme, useTheme } from "../lib/theme";
import { PackageIcon } from "./PackageIcon";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { IntroTour } from "./IntroTour";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { ShellLink } from "./ShellLink";
import { projectToolSlug } from "../pages/ProjectHome";

function readSidebarPreference(): boolean {
  try {
    return localStorage.getItem("assets-toolbox-sidebar") === "collapsed";
  } catch {
    return false;
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const theme = useTheme();
  const [systemInfo, setSystemInfo] = useState<NativeSystemInfo | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPreference);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => !hasSeenTour());
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { flushAll } = useFlushRegistry();
  const mcpFlush = useCallback(async () => true, []);
  useDesktopFlush("mcp", mcpFlush);

  useEffect(() => {
    const unregister = registerMcpBridge();
    setDesktopModuleActive("mcp", true);
    return () => {
      unregister();
      setDesktopModuleActive("mcp", false);
    };
  }, []);

  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentSlug = pathParts[0] === "projects" ? (pathParts[2] ?? "") : (pathParts[1] ?? "");
  const toolPackagesBySlug: Record<string, string> = {
    compose: "svg-compose",
    studio: "screenshot-studio",
    sound: "cabra-sound",
    expo: "expo-assets",
    brand: "brand-assets",
    inspect: "social-inspect",
  };
  const currentPackage = findPackage(toolPackagesBySlug[currentSlug] ?? currentSlug);
  const currentLabel =
    currentPackage?.name ?? (pathParts[0] === "projects" ? "Project" : "Projects");
  const editorRoute =
    currentSlug === "compose" ||
    currentSlug === "studio" ||
    location.pathname.startsWith("/packages/svg-compose") ||
    location.pathname.startsWith("/packages/screenshot-studio");
  const projectId = getActiveProjectId();
  const inProject = pathParts[0] === "projects" && Boolean(pathParts[1]);
  const platform = systemInfo ? formatPlatform(systemInfo) : "Connecting";
  let backendLabel = "Connecting to Go";
  if (systemInfo) backendLabel = systemInfo.desktop ? "Go backend connected" : "Browser preview";

  useEffect(() => {
    let active = true;
    void getSystemInfo()
      .then((info) => {
        if (active) setSystemInfo(info);
      })
      .catch(() => {
        if (active) setSystemInfo(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      if (current.pathname === next.pathname) return false;
      return !(await flushAll());
    },
    enableBeforeUnload: false,
  });

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isMobile) setNavOpen(false);
  }, [isMobile]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const sidebar = sidebarRef.current;
    const focusable = sidebar?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    first?.focus();

    function handleDrawerKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setNavOpen(false);
        return;
      }
      if (event.key !== "Tab" || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDrawerKeydown);
    return () => {
      document.removeEventListener("keydown", handleDrawerKeydown);
      menuButtonRef.current?.focus();
    };
  }, [navOpen]);

  useEffect(() => {
    document.title = `${currentLabel} · Assets Toolbox`;
  }, [currentLabel]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem("assets-toolbox-sidebar", next ? "collapsed" : "expanded");
      } catch {
        // The in-memory preference still works when storage is unavailable.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const replay = () => setTourOpen(true);
    window.addEventListener("assets-toolbox:replay-tour", replay);
    return () => window.removeEventListener("assets-toolbox:replay-tour", replay);
  }, []);

  useEffect(() => {
    function handleShortcutKey(event: KeyboardEvent) {
      if (event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target;
        const typing =
          target instanceof Element &&
          target.closest("input, textarea, select, [contenteditable='true']");
        if (typing) return;
        event.preventDefault();
        setShortcutsOpen((open) => !open);
        return;
      }
      if (event.key === "Escape" && shortcutsOpen) setShortcutsOpen(false);
    }
    window.addEventListener("keydown", handleShortcutKey);
    return () => window.removeEventListener("keydown", handleShortcutKey);
  }, [shortcutsOpen]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.repeat || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") {
        return;
      }
      event.preventDefault();
      toggleSidebar();
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [toggleSidebar]);

  if (location.pathname === "/") {
    return (
      <div className="launch-shell">
        <main className="launch-main">
          <div className="page-content">{children}</div>
        </main>
        {shortcutsOpen ? <ShortcutsDialog onClose={() => setShortcutsOpen(false)} /> : null}
        {tourOpen ? <IntroTour onClose={() => setTourOpen(false)} /> : null}
      </div>
    );
  }

  return (
    <div
      className={`app-shell${sidebarCollapsed ? " collapsed" : ""}${editorRoute ? " editor-route" : ""}`}
    >
      {navOpen ? (
        <button
          type="button"
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside
        ref={sidebarRef}
        className={`sidebar${navOpen ? " open" : ""}${sidebarCollapsed ? " collapsed" : ""}`}
        aria-label="Workspace navigation"
        aria-hidden={isMobile && !navOpen ? true : undefined}
        inert={isMobile && !navOpen}
        onClickCapture={(event) => {
          if (navOpen && (event.target as Element).closest("a[href]")) setNavOpen(false);
        }}
      >
        <ShellLink to="/" className="brand" aria-label="Assets Toolbox home">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <strong>Assets Toolbox</strong>
            <small>Desktop workspace</small>
          </span>
        </ShellLink>

        <ProjectSwitcher collapsed={sidebarCollapsed} />

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-label">Projects</span>
            <ShellLink
              to="/"
              className="nav-link"
              aria-label="Projects"
              title="Projects"
              aria-current={location.pathname === "/" ? "page" : undefined}
            >
              <LayoutGrid size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Projects</span>
              <span className="nav-count">{toolPackages.length}</span>
            </ShellLink>
          </div>

          {inProject ? (
            <div className="nav-section">
              <span className="nav-label">Tools</span>
              {toolPackages.map((tool) => {
                const active = currentSlug === projectToolSlug(tool.id);
                return projectId ? (
                  <Link
                    key={tool.id}
                    to="/projects/$projectId/$tool"
                    params={{ projectId, tool: projectToolSlug(tool.id) }}
                    className="nav-link"
                    aria-label={tool.shortName}
                    title={tool.shortName}
                    aria-current={active ? "page" : undefined}
                  >
                    <PackageIcon name={tool.icon} size={17} />
                    <span>{tool.shortName}</span>
                  </Link>
                ) : (
                  <ShellLink
                    key={tool.id}
                    to="/"
                    className="nav-link"
                    aria-label={tool.shortName}
                    title={tool.shortName}
                  >
                    <PackageIcon name={tool.icon} size={17} />
                    <span>{tool.shortName}</span>
                  </ShellLink>
                );
              })}
            </div>
          ) : null}

          <div className="nav-section">
            <span className="nav-label">Developer</span>
            <ShellLink
              to="/mcp"
              className="nav-link"
              aria-label="MCP"
              title="MCP"
              aria-current={location.pathname === "/mcp" ? "page" : undefined}
            >
              <Braces size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>MCP</span>
            </ShellLink>
            <ShellLink
              to="/help"
              className="nav-link"
              aria-label="Help"
              title="Help"
              aria-current={location.pathname === "/help" ? "page" : undefined}
            >
              <CircleHelp size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Help</span>
            </ShellLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="backend-status">
            <div className="backend-line">
              <span>{backendLabel}</span>
            </div>
            <div className="backend-meta">
              <span>{platform}</span>
              <span>v{systemInfo?.version ?? "0.1.0"}</span>
            </div>
          </div>

          <div className="sidebar-controls">
            <button
              type="button"
              className="sidebar-control theme-control"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Sun size={17} aria-hidden="true" />
              ) : (
                <Moon size={17} aria-hidden="true" />
              )}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <button
              type="button"
              className="sidebar-control collapse-control"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar (Ctrl+B)`}
              aria-expanded={!sidebarCollapsed}
              onClick={toggleSidebar}
            >
              <PanelLeft size={18} aria-hidden="true" />
              <span>{sidebarCollapsed ? "Expand" : "Collapse"}</span>
            </button>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <button
          ref={menuButtonRef}
          type="button"
          className="icon-button menu-button shell-menu-button"
          aria-label={navOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          <List size={18} aria-hidden="true" />
        </button>

        <main className="main-scroll">
          <div className="page-content">{children}</div>
        </main>
      </section>
      {shortcutsOpen ? <ShortcutsDialog onClose={() => setShortcutsOpen(false)} /> : null}
      {tourOpen ? <IntroTour onClose={() => setTourOpen(false)} /> : null}
    </div>
  );
}
