# कुल्फीवाला

A zero-build, Vercel-ready nostalgic Bollywood radio. YouTube is the audio
engine (offscreen player); the page draws its own transport, cover art and
progress bar. Spotify is a plain link out.

## Change the playlists

Edit `PLAYLISTS` at the top of `check-tracks.mjs` — one entry per collection,
mapping a global variable name to a playlist, the artist label its tracks carry
and the `label` its switcher chip shows — then regenerate:

```bash
node check-tracks.mjs
```

That rewrites `tracks.js` from every playlist, in playlist order, dropping
videos that refuse to embed. Playlists must be public or unlisted.

Keep the `KULFI_TRACKS_<n>` naming. `app.js` discovers collections by scanning
for that pattern and orders the switcher by `<n>`, so a new entry gets its own
chip with no UI change. `label` falls back to `artist` if you omit it.

If YouTube rate-limits the embed check it says so loudly and keeps every track
rather than writing a short or empty list — wait a few minutes and re-run.

The site deliberately does **not** hand the playlist to YouTube at runtime — see
the note in `youtube-player.js`. It owns its queue, so the running order is
whatever is in `tracks.js`.

## Hindi titles

Generated entries carry the (cleaned up) English YouTube title:

```js
window.KULFI_TRACKS_1 = [
  { id: "N0jnLZxYwYc", title: "मुझसे मोहब्बत का इज़हार", artist: "Kumar Sanu • Hum Hain Rahi Pyar Ke" },
];
```

Rewrite any `title` in Devanagari and **it survives regeneration** — the
generator keeps every entry whose title contains Devanagari and only refreshes
the rest. Cover art always comes from the video ID.

## Notes

- Playback needs a user gesture, so the first sound comes from the bell button.
- The horn buttons under the bell play `assets/horn-1.mp3` … `horn-3.mp3` over
  the music. The files are not in the repo yet; until they are, the buttons are
  a deliberate no-op (the `play()` rejection is swallowed). `assets/` is cached
  `immutable`, so version the filename if you ever replace a clip.
- Videos with embedding disabled fire `onError` (101/150) and are skipped. Any
  other error code is a player/origin problem and must NOT skip — doing so
  races the queue through the whole playlist.
- Test on `http://localhost:PORT`, not `http://127.0.0.1:PORT`. YouTube matches
  the `origin` player var against the referrer and is flakier on the raw IP.
- The YouTube iframe is positioned offscreen at full size, not `display:none` —
  hiding it outright makes browsers throttle or stop the audio.
- Do not try to hand the playlist to YouTube. `listType`/`list` with no
  `videoId` generates a malformed embed URL (the iframe never reaches
  youtube.com — "postMessage target origin does not match"), and
  `loadPlaylist()` fails silently, stranding the player on one video with a dead
  next/previous. Both were tried; `loadVideoById` over our own list is what
  works.
- Player events fire before `await mount()` resolves, so handlers must use
  `e.target`, never the module-level `player` (still undefined at that point).

## Preview

```bash
python3 -m http.server 4173
```

Visit `http://localhost:4173`. Deploy the folder directly to Vercel; there is no
build command and no framework dependency.

## Artwork

`assets/kulfiwala-hero.png` is original AI-generated artwork created for this
project. The interface typography is live HTML for crisp, accessible Hindi.
