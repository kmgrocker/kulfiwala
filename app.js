/*
 * YouTube is the audio engine (offscreen player, see #yt-host in styles.css).
 * Spotify stays a plain link — its embed can't be hidden, exposes no track
 * metadata, and shows its own "Get Spotify" overlay.
 */
const SPOTIFY_URL = "https://open.spotify.com/playlist/7wJi3b7M4qfOfI1C4sYJUf";

/*
 * The queue lives here, not in YouTube's playlist mechanics — listType/list and
 * loadPlaylist() both fail silently in an offscreen embed, leaving the player
 * stuck on one video with no next/previous. tracks.js is generated from the
 * playlist by check-tracks.mjs; re-run it after changing the playlist.
 */

/*
 * Collections are found by naming convention, not listed anywhere — every
 * window.KULFI_TRACKS_<n> that tracks.js defines gets a chip, so adding a
 * playlist to check-tracks.mjs and regenerating is the whole workflow.
 */
const COLLECTIONS = Object.keys(window)
  .filter((key) => /^KULFI_TRACKS_\d+$/.test(key))
  .sort((a, b) => +a.split("_").pop() - +b.split("_").pop()) // _10 after _2, not before
  .map((key) => ({
    label: window.KULFI_LABELS?.[key] ?? window[key][0]?.artist ?? key,
    tracks: window[key],
  }));

let TRACKS = COLLECTIONS[0].tracks;

const $ = (s) => document.querySelector(s);
const ui = {
  shell: $(".player-shell"),
  collections: $("#collections"),
  play: $("#play"),
  prev: $("#prev"),
  next: $("#next"),
  heroPlay: $("#hero-play"),
  cover: $("#cover"),
  title: $("#track-title"),
  artist: $("#track-artist"),
  bar: $("#progress-bar"),
  fill: $("#progress-fill"),
  elapsed: $("#time-elapsed"),
  total: $("#time-total"),
  toast: $("#toast"),
};

let player;
let index = Math.floor(Math.random() * TRACKS.length);
let playing = false;
let skips = 0; // consecutive un-embeddable tracks; caps the auto-skip cascade

const coverUrl = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const fmt = (s) =>
  Number.isFinite(s) && s > 0
    ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
    : "0:00";

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.toast.classList.remove("show"), 2800);
}

/* Paint title/art immediately so the UI never waits on the iframe. */
function renderTrack() {
  const track = TRACKS[index];
  ui.title.textContent = track.title;
  ui.artist.textContent = track.artist;
  ui.cover.classList.remove("loaded");
  ui.cover.onload = () => ui.cover.classList.add("loaded");
  ui.cover.src = coverUrl(track.id);
  ui.fill.style.width = "0%";
  ui.elapsed.textContent = "0:00";
  ui.total.textContent = "0:00";
  // Warm the next cover so skipping never flashes an empty circle.
  new Image().src = coverUrl(TRACKS[(index + 1) % TRACKS.length].id);
}

function setPlaying(state) {
  playing = state;
  ui.shell.classList.toggle("is-playing", state);
  ui.play.setAttribute("aria-label", state ? "रोकें" : "चलाएँ");
}

function go(step) {
  index = (index + step + TRACKS.length) % TRACKS.length;
  renderTrack();
  if (!player) return start();
  player.loadVideoById(TRACKS[index].id);
  setPlaying(true);
}

function renderCollections() {
  ui.collections.replaceChildren(
    ...COLLECTIONS.map(({ label }, i) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = label;
      chip.setAttribute("aria-pressed", String(i === 0));
      chip.classList.toggle("is-active", i === 0);
      chip.addEventListener("click", () => selectCollection(i));
      return chip;
    }),
  );
}

function selectCollection(i) {
  TRACKS = COLLECTIONS[i].tracks;
  index = 0;
  skips = 0;
  [...ui.collections.children].forEach((chip, n) => {
    chip.classList.toggle("is-active", n === i);
    chip.setAttribute("aria-pressed", String(n === i));
  });
  const chip = ui.collections.children[i];
  chip.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  // Space is ignored while a button holds focus (see the keydown guard), so
  // hand focus back or the shortcut dies after the first chip click.
  chip.blur();
  showToast(COLLECTIONS[i].label);
  renderTrack();
  if (!player) return;
  player.loadVideoById(TRACKS[index].id);
  setPlaying(true);
}

function toggle() {
  if (!player) return start();
  playing ? player.pauseVideo() : player.playVideo();
}

async function start() {
  if (start.pending) return;
  start.pending = true;
  showToast("घंटी बज रही है…");
  try {
    player = await window.KulfiYouTubePlayer.mount({
      elementId: "yt-host",
      videoId: TRACKS[index].id,
      events: {
        onReady: (e) => e.target.playVideo(),
        onStateChange: (e) => {
          const YT = window.YT.PlayerState;
          if (e.data === YT.PLAYING) {
            skips = 0;
            setPlaying(true);
          }
          if (e.data === YT.PAUSED) setPlaying(false);
          // YouTube also emits ENDED while swapping videos. Only a real finish
          // (playhead actually at the end) should advance the queue.
          if (e.data === YT.ENDED) {
            const duration = e.target.getDuration();
            if (duration && e.target.getCurrentTime() > duration - 3) go(1);
          }
        },
        onError: (e) => {
          // Only 101/150 mean "uploader disabled embedding" — skip those.
          // Everything else (2, 5, 153…) is a player/origin problem; skipping
          // on those is what made the queue race through the whole playlist.
          if (e.data !== 101 && e.data !== 150) {
            showToast(`यूट्यूब प्लेयर की दिक्कत (${e.data})`);
            setPlaying(false);
            return;
          }
          if (++skips >= TRACKS.length) return showToast("कोई गीत नहीं बज पा रहा");
          showToast("यह गीत यहाँ नहीं बजेगा — अगला…");
          go(1);
        },
      },
    });
  } catch (error) {
    start.pending = false;
    console.error("[kulfiwala] player failed to mount:", error);
    showToast("प्लेयर लोड नहीं हो पाया");
  }
}

/* One ticker for the progress bar; cheap enough at 4fps. */
setInterval(() => {
  if (!player?.getDuration) return;
  const duration = player.getDuration();
  const current = player.getCurrentTime();
  if (!duration) return;
  ui.fill.style.width = `${(current / duration) * 100}%`;
  ui.elapsed.textContent = fmt(current);
  ui.total.textContent = fmt(duration);
}, 250);

ui.bar.addEventListener("click", (event) => {
  if (!player?.getDuration) return;
  const { left, width } = ui.bar.getBoundingClientRect();
  player.seekTo(((event.clientX - left) / width) * player.getDuration(), true);
});

ui.play.addEventListener("click", toggle);
ui.heroPlay.addEventListener("click", toggle);
ui.prev.addEventListener("click", () => go(-1));
ui.next.addEventListener("click", () => go(1));

/* Street sounds, layered over the music. A missing file just does nothing. */
document.querySelectorAll("[data-horn]").forEach((button) => {
  button.addEventListener("click", () => {
    new Audio(button.dataset.horn).play().catch(() => {});
  });
});

document.addEventListener("keydown", (event) => {
  if (["INPUT", "BUTTON", "A"].includes(document.activeElement.tagName)) return;
  if (event.code === "Space") {
    event.preventDefault();
    toggle();
  }
});

function updateClock() {
  $("#local-time").textContent = new Intl.DateTimeFormat("hi-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

// ponytail: fake presence — no backend. Clock-seeded, so every visitor sees the
// same number at the same moment. Real count = Vercel edge fn + KV heartbeat.
function updateOnline() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const base = 14 + 30 * Math.exp(-((hour - 21) ** 2) / 14); // evening peak
  const noise = Math.sin(Math.floor(now.getTime() / 20_000) * 12.9898) * 43758.5453;
  const count = Math.max(3, Math.round(base + (noise - Math.floor(noise)) * 9 - 4));
  $("#online-count").innerHTML =
    `<i></i> ${new Intl.NumberFormat("hi-IN-u-nu-deva").format(count)} सुन रहे हैं`;
}

$("#spotify-link").href = SPOTIFY_URL;
renderCollections();
renderTrack();
updateClock();
updateOnline();
setInterval(updateClock, 60_000);
setInterval(updateOnline, 20_000);
