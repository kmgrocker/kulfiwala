/*
 * YouTube is the audio engine (offscreen player, see #yt-host in styles.css).
 * Spotify stays a plain link — its embed can't be hidden, exposes no track
 * metadata, and shows its own "Get Spotify" overlay.
 */
const SPOTIFY_URL = "https://open.spotify.com/playlist/7wJi3b7M4qfOfI1C4sYJUf";
const TRACKS = window.KULFI_TRACKS;

const $ = (s) => document.querySelector(s);
const ui = {
  shell: $(".player-shell"),
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
      videoIds: [TRACKS[index].id],
      events: {
        onReady: (e) => e.target.playVideo(),
        onStateChange: (e) => {
          const YT = window.YT.PlayerState;
          if (e.data === YT.ENDED) return go(1);
          if (e.data === YT.PLAYING) setPlaying(true);
          if (e.data === YT.PAUSED) setPlaying(false);
        },
        // 101/150 = embedding disabled by the uploader. Skip, don't stall.
        onError: () => {
          showToast("यह गीत यहाँ नहीं बजेगा — अगला…");
          go(1);
        },
      },
    });
  } catch (error) {
    start.pending = false;
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

$("#spotify-link").href = SPOTIFY_URL;
renderTrack();
updateClock();
setInterval(updateClock, 60_000);
