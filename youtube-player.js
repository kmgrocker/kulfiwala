/*
 * Loads the YouTube IFrame API on demand and mounts a player.
 * The host element is positioned offscreen (see #yt-host in styles.css) — the
 * page draws its own transport, YouTube is only the audio engine.
 */
(function attachYouTubePlayer(global) {
  let apiPromise;

  function loadYouTubeApi() {
    if (global.YT?.Player) return Promise.resolve(global.YT);
    if (apiPromise) return apiPromise;

    apiPromise = new Promise((resolve, reject) => {
      global.onYouTubeIframeAPIReady = () => resolve(global.YT);
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.addEventListener("error", () => reject(new Error("YouTube IFrame API failed to load")), { once: true });
      document.head.appendChild(script);
    });

    return apiPromise;
  }

  async function mount({ elementId, playlistId = "", videoIds = [], events = {} }) {
    if (!document.getElementById(elementId)) throw new Error(`Missing element #${elementId}`);
    if (!playlistId && videoIds.length === 0) throw new Error("Need a playlistId or at least one videoId");

    const YT = await loadYouTubeApi();
    const playerVars = {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      playsinline: 1,
      rel: 0,
      origin: global.location.origin,
    };
    if (playlistId) Object.assign(playerVars, { listType: "playlist", list: playlistId });

    return new YT.Player(elementId, {
      width: "320",
      height: "180",
      videoId: playlistId ? undefined : videoIds[0],
      playerVars,
      events,
    });
  }

  global.KulfiYouTubePlayer = { mount };
})(window);
