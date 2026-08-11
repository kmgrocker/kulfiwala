/* node check-tracks.mjs — fails if any track went dead or private on YouTube. */
import { readFileSync } from "node:fs";

const window = {};
new Function("window", readFileSync("tracks.js", "utf8"))(window);

const dead = [];
for (const { id, title } of window.KULFI_TRACKS) {
  const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
  if (!res.ok) dead.push(`${id} — ${title}`);
}

console.log(`${window.KULFI_TRACKS.length} tracks checked, ${dead.length} dead`);
if (dead.length) {
  console.error(dead.join("\n"));
  process.exit(1);
}
