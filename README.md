# कुल्फीवाला

A zero-build, Vercel-ready nostalgic Bollywood radio. YouTube is the audio
engine (offscreen player); the page draws its own transport, cover art and
progress bar. Spotify is a plain link out.

## Edit the playlist

Everything lives in `tracks.js`:

```js
window.KULFI_TRACKS = [
  { id: "N0jnLZxYwYc", title: "मुझसे मोहब्बत का इज़हार", artist: "Kumar Sanu • Hum Hain Rahi Pyar Ke" },
];
```

`id` is the YouTube video ID (the `v=` part of the watch URL). `title` and
`artist` are written by hand on purpose — raw YouTube titles look like
`"Full Lyrical Video Song | ... | 90's Best Song"` and would wreck the UI.
Cover art is derived automatically from the ID.

Verify nothing has gone dead or private:

```bash
node check-tracks.mjs
```

## Whole YouTube playlists

`KulfiYouTubePlayer.mount()` also accepts `playlistId: "PL..."` instead of
`videoIds`, but then YouTube owns the queue and you get its raw titles — no
curated Hindi names, no per-track art. Use `tracks.js` unless you want that
trade.

## Notes

- Playback needs a user gesture, so the first sound comes from the bell button.
- Videos with embedding disabled fire `onError` (101/150) and are skipped.
- The YouTube iframe is positioned offscreen at full size, not `display:none` —
  hiding it outright makes browsers throttle or stop the audio.

## Preview

```bash
python3 -m http.server 4173
```

Visit `http://localhost:4173`. Deploy the folder directly to Vercel; there is no
build command and no framework dependency.

## Artwork

`assets/kulfiwala-hero.png` is original AI-generated artwork created for this
project. The interface typography is live HTML for crisp, accessible Hindi.
