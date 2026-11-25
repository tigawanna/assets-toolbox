import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const built = fileURLToPath(new URL("dist/index.mjs", root));
const demo = fileURLToPath(new URL("demo/sound-board.html", root));

const start = "// DEMO:MODULE:START";
const end = "// DEMO:MODULE:END";

const [js, html] = await Promise.all([readFile(built, "utf8"), readFile(demo, "utf8")]);
const from = html.indexOf(start);
const to = html.indexOf(end);
if (from < 0 || to < 0 || to < from) throw new Error("Demo markers not found");

if (js.includes("</script")) throw new Error("Built module cannot be inlined into a script tag");

const attribution =
  "// Sound designs based on Bencho by cabralorenzo: " +
  "https://github.com/cabralorenzo/bencho/tree/main/sounds";

const next =
  html.slice(0, from + start.length) +
  "\n" +
  attribution +
  "\n" +
  js.trimEnd() +
  "\n" +
  html.slice(to);
await writeFile(demo, next);
console.log(`Embedded ${built} into ${demo}`);
