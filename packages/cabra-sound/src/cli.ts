#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";

const demoPath = fileURLToPath(new URL("../demo/sound-board.html", import.meta.url));
const command = process.argv[2] ?? "studio";

if (command !== "studio" && command !== "-h" && command !== "--help") {
  console.error(`Unknown command: ${command}`);
  console.error("Usage: npx @tigawanna/cabra-sound studio");
  process.exitCode = 1;
} else if (command === "-h" || command === "--help") {
  console.log("Usage: npx @tigawanna/cabra-sound studio");
  console.log("Serves the sound board demo locally and opens it in your browser.");
} else {
  await studio();
}

function openBrowser(url: string): void {
  if (process.env.CI || process.env.NO_OPEN) return;
  let command = "xdg-open";
  let args = [url];
  if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else if (process.platform === "darwin") {
    command = "open";
  }
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {
    // No browser available — the URL is printed below.
  });
  child.unref();
}

function listen(server: Server, port: number, attempts = 12): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      if (error.code === "EADDRINUSE" && attempts > 1) {
        server.removeListener("error", onError);
        resolve(listen(server, port + 1, attempts - 1));
      } else {
        reject(error);
      }
    };
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", onError);
      resolve(port);
    });
  });
}

async function studio(): Promise<void> {
  const server = createServer((request, response) => {
    if (request.url === "/" || request.url?.startsWith("/?")) {
      readFile(demoPath).then(
        (html) => {
          response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          response.end(html);
        },
        () => {
          response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
          response.end("Could not read the sound board demo");
        },
      );
      return;
    }
    if (request.url === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  });

  try {
    const port = await listen(server, Number(process.env.PORT ?? 5178));
    const url = `http://127.0.0.1:${port}`;
    console.log(`Cabra Sound Board → ${url}`);
    console.log("Press Ctrl+C to stop.");
    openBrowser(url);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      server.close(() => process.exit(0));
    });
  }
}
