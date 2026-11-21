/** Minimal ambient types for the optional Playwright peer used only by `render`. */
declare module "playwright" {
  export interface Page {
    goto(url: string): Promise<unknown>;
    waitForFunction(fn: () => boolean, options?: { timeout?: number }): Promise<unknown>;
    evaluate<T>(fn: () => T): Promise<T>;
    close(): Promise<void>;
  }
  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }
  export const chromium: {
    launch(options?: { headless?: boolean; args?: string[] }): Promise<Browser>;
  };
}
