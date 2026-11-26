import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { DesktopFlush, DesktopModule } from "./desktop";

interface FlushRegistry {
  register: (module: DesktopModule, flush: DesktopFlush | null) => void;
  flushAll: () => Promise<boolean>;
}

const FlushContext = createContext<FlushRegistry | null>(null);

export function DesktopFlushProvider({ children }: { children: ReactNode }) {
  const modules = useRef(new Map<DesktopModule, DesktopFlush>());

  const register = useCallback((module: DesktopModule, flush: DesktopFlush | null) => {
    if (flush) modules.current.set(module, flush);
    else modules.current.delete(module);
  }, []);

  const flushAll = useCallback(async () => {
    const results = await Promise.all(
      [...modules.current.values()].map(async (flush) => {
        try {
          return await flush();
        } catch {
          return false;
        }
      }),
    );
    return results.every(Boolean);
  }, []);

  const value = useMemo(() => ({ register, flushAll }), [flushAll, register]);
  return <FlushContext.Provider value={value}>{children}</FlushContext.Provider>;
}

export function useDesktopFlush(module: DesktopModule, flush: DesktopFlush | null) {
  const { register } = useFlushRegistry();
  useEffect(() => {
    register(module, flush);
    return () => register(module, null);
  }, [flush, module, register]);
}

export function useFlushRegistry(): FlushRegistry {
  const registry = useContext(FlushContext);
  if (!registry) throw new Error("DesktopFlushProvider is missing");
  return registry;
}
