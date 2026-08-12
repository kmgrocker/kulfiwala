/*
 * node check-tracks.mjs — rewrites tracks.js from the YouTube playlists below.
 *
 * The IFrame API's own playlist mechanics (listType/list, loadPlaylist) proved
 * unreliable in an offscreen embed, so the site owns its queue: this pulls each
 * playlist, drops anything that will not embed, and writes plain lists that
 * app.js drives with loadVideoById.
 *
 * Hand-written Devanagari titles are preserved — re-run it whenever you change
 * a playlist on YouTube.
 */
import { readFileSync, writeFileSync } from "node:fs";

/*
 * Global variable name → playlist. Add an entry to add a collection; keep the
 * KULFI_TRACKS_N shape, because app.js finds collections by that pattern and
 * orders the switcher by N.
 * `artist` labels the whole playlist; the watch pages only expose the uploading
 * channel ("Kumar Sanu Hit Songs"), which reads worse than just naming a singer.
 * `label` is what the switcher chip says, and falls back to `artist`.
 */
const PLAYLISTS = {
  KULFI_TRACKS_1: { id: "PLO6WOx_nE9UJzbMpS9_yRiQNIym2FvIxY", artist: "अल्ताफ़ राजा", label: "दर्द भरे नग़्मे" },
  KULFI_TRACKS_2: { id: "PLoBdg15_smAAZL0QBG7G7Hkp0W0p4pk5f", artist: "कुमार सानू", label: "सानू की शामें" },
};

// YouTube 429s a burst of watch-page fetches and bounces them to
// google.com/sorry. Stay slow; a regeneration is a rare, offline chore.
const CONCURRENCY = 3;
const PAUSE_MS = 250;
const DEVANAGARI = /[ऀ-ॿ]/;
const GET = { headers: { "Accept-Language": "en-US" } };

/* "Tujhe Dekha To (HD) | Full Video Song | 4K" → "Tujhe Dekha To" */
const cleanTitle = (raw) =>
  raw
    .replace(/[([][^)\]]*[)\]]/g, "")
    .split("|")[0]
    .replace(/\s*[-–—]\s*(full|video|audio|hd|4k|lyrical|official|song).*$/i, "")
    .trim() || raw;

/*
 * Both the ids and the titles come from the playlist page, so the only
 * per-video traffic is the embed check. Videos live in ytInitialData as
 * lockupViewModel blocks; splitting on that is sturdier than one huge regex.
 */
async function playlistEntries(playlistId) {
  const res = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, GET);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching playlist ${playlistId}`);
  const html = await res.text();

  const entries = new Map();
  for (const chunk of html.split('"lockupViewModel":')) {
    const id = chunk.match(/"contentId":"([A-Za-z0-9_-]{11})"/)?.[1];
    const title = chunk.match(
      /"lockupMetadataViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)*)"/,
    )?.[1];
    if (id && title && !entries.has(id)) entries.set(id, JSON.parse(`"${title}"`));
  }
  if (!entries.size) throw new Error(`No videos in ${playlistId} — is it public?`);
  return [...entries].map(([id, title]) => ({ id, title }));
}

const embeddable = new Map(); // shared, so a video in two playlists is checked once
let throttled = false;

async function checkEmbeddable(ids) {
  const queue = ids.filter((id) => !embeddable.has(id));
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length && !throttled) {
        const id = queue.shift();
        await new Promise((r) => setTimeout(r, PAUSE_MS));
        const res = await fetch(`https://www.youtube.com/watch?v=${id}`, GET);
        const html = await res.text();
        // A throttled request looks nothing like an un-embeddable video. Never
        // confuse the two — that silently emptied tracks.js once already.
        if (res.status === 429 || res.url.includes("/sorry/")) {
          throttled = true;
          return;
        }
        embeddable.set(id, res.ok && html.includes('"playableInEmbed":true'));
      }
    }),
  );
}

const window = {};
new Function("window", readFileSync("tracks.js", "utf8"))(window);
// Only Devanagari entries count as hand-written; generated English ones get refreshed.
const kept = new Map(
  Object.keys(PLAYLISTS)
    .flatMap((name) => window[name] ?? [])
    .filter((t) => DEVANAGARI.test(t.title))
    .map((t) => [t.id, t]),
);

const blocks = [];
for (const [name, { id: playlistId, artist }] of Object.entries(PLAYLISTS)) {
  const entries = await playlistEntries(playlistId);
  await checkEmbeddable(entries.map((e) => e.id));

  // When throttled, keep everything rather than dropping the playlist: the
  // player skips un-embeddable videos at runtime anyway.
  const playable = entries.filter((e) => embeddable.get(e.id) ?? true);
  const tracks = playable.map((e) => {
    const hand = kept.get(e.id);
    return hand
      ? { ...hand, artist: hand.artist || artist } // keep the title, fill a blank artist
      : { id: e.id, title: cleanTitle(e.title), artist };
  });
  if (!tracks.length) throw new Error(`${name}: every video came back unplayable — aborting`);

  blocks.push(
    `/* ${playlistId} — ${tracks.length} of ${entries.length} */\nwindow.${name} = [\n` +
      tracks
        .map(
          (t) =>
            `  { id: ${JSON.stringify(t.id)}, title: ${JSON.stringify(t.title)}, artist: ${JSON.stringify(t.artist)} },`,
        )
        .join("\n") +
      "\n];",
  );
  console.log(`${name}: ${entries.length} in playlist → ${tracks.length} kept`);
}

const labels = Object.fromEntries(
  Object.entries(PLAYLISTS).map(([name, { artist, label }]) => [name, label ?? artist]),
);

writeFileSync(
  "tracks.js",
  `/*
 * Generated by check-tracks.mjs. Rewrite any title or artist in Devanagari and
 * it will survive the next regeneration.
 */
${blocks.join("\n\n")}

/* Switcher chip labels, keyed by the globals above. */
window.KULFI_LABELS = ${JSON.stringify(labels, null, 2)};
`,
);

if (throttled) {
  console.warn(
    "\nWARNING: YouTube rate-limited the embed check, so un-embeddable videos\n" +
      "were NOT filtered out. Wait a few minutes and re-run to clean the list.",
  );
}
