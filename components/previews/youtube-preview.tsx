"use client";

import * as React from "react";
import Script from "next/script";

interface YouTubePlayerInstance {
  cueVideoById(videoId: string, startSeconds?: number): void;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
  getVideoData(): { video_id?: string };
  loadVideoById(videoId: string, startSeconds?: number): void;
  mute(): void;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  unMute(): void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayerInstance;
}

interface YouTubePlayerStateEvent extends YouTubePlayerEvent {
  data: number;
}

interface YouTubePlayerOptions {
  events: {
    onAutoplayBlocked?: () => void;
    onError?: () => void;
    onReady: (event: YouTubePlayerEvent) => void;
    onStateChange?: (event: YouTubePlayerStateEvent) => void;
  };
  host?: string;
  height?: number | string;
  playerVars: Record<string, number | string>;
  videoId: string;
  width?: number | string;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayerInstance;
}

export interface YouTubePlayerHandle {
  mute(): void;
  pause(): void;
  play(): void;
  unmuteAndPlay(): void;
}

const YOUTUBE_PLAYER_STATE_ENDED = 0;

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YouTubePreview = React.forwardRef<
  YouTubePlayerHandle,
  {
    videoKey: string;
    title: string;
    soundEnabled: boolean;
    shouldPlay: boolean;
    playerOrigin?: string;
    onAutoplayBlocked: () => void;
    onPlayerReady: () => void;
    onPlaybackError: (videoKey: string) => void;
    onVideoVisible: (videoKey: string) => void;
  }
>(function YouTubePreview(
  {
    videoKey,
    title,
    soundEnabled,
    shouldPlay,
    playerOrigin,
    onAutoplayBlocked,
    onPlayerReady,
    onPlaybackError,
    onVideoVisible,
  },
  forwardedRef,
) {
  const mountRef = React.useRef<HTMLDivElement>(null);
  const playerRef = React.useRef<YouTubePlayerInstance | null>(null);
  const readyRef = React.useRef(false);
  const loadedVideoRef = React.useRef(videoKey);
  const videoKeyRef = React.useRef(videoKey);
  const soundEnabledRef = React.useRef(soundEnabled);
  const shouldPlayRef = React.useRef(shouldPlay);
  const onAutoplayBlockedRef = React.useRef(onAutoplayBlocked);
  const onPlaybackErrorRef = React.useRef(onPlaybackError);
  const onPlayerReadyRef = React.useRef(onPlayerReady);
  const onVideoVisibleRef = React.useRef(onVideoVisible);
  const titleRef = React.useRef(title);
  const [apiReady, setApiReady] = React.useState(() =>
    Boolean(typeof window !== "undefined" && window.YT?.Player),
  );

  const syncPlayer = React.useCallback(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;

    if (soundEnabledRef.current) player.unMute();
    else player.mute();

    if (loadedVideoRef.current !== videoKeyRef.current) {
      // Cue first without playback. The parent reveals this exact keyed frame
      // after CUED, then a subsequent visible commit is allowed to play it.
      player.cueVideoById(videoKeyRef.current, 0);
      loadedVideoRef.current = videoKeyRef.current;
      return;
    } else if (shouldPlayRef.current) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, []);

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      mute() {
        if (readyRef.current) playerRef.current?.mute();
      },
      pause() {
        // Keep the intent ref in sync immediately so an ENDED event racing the
        // user's pause (or pagehide) cannot start another loop iteration.
        shouldPlayRef.current = false;
        if (readyRef.current) playerRef.current?.pauseVideo();
      },
      play() {
        shouldPlayRef.current = true;
        if (readyRef.current) playerRef.current?.playVideo();
      },
      unmuteAndPlay() {
        // These calls intentionally happen inside the user's click stack so
        // WebKit can grant audio to this persistent media session.
        shouldPlayRef.current = true;
        if (readyRef.current) {
          playerRef.current?.unMute();
          playerRef.current?.playVideo();
        }
      },
    }),
    [],
  );

  React.useLayoutEffect(() => {
    videoKeyRef.current = videoKey;
    soundEnabledRef.current = soundEnabled;
    shouldPlayRef.current = shouldPlay;
    onAutoplayBlockedRef.current = onAutoplayBlocked;
    onPlayerReadyRef.current = onPlayerReady;
    onPlaybackErrorRef.current = onPlaybackError;
    onVideoVisibleRef.current = onVideoVisible;
    titleRef.current = title;
    syncPlayer();
    const iframe = mountRef.current?.querySelector("iframe");
    iframe?.setAttribute("title", title);
  }, [
    onAutoplayBlocked,
    onPlayerReady,
    onPlaybackError,
    onVideoVisible,
    soundEnabled,
    shouldPlay,
    syncPlayer,
    title,
    videoKey,
  ]);

  React.useEffect(() => {
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }
    const previousReady = window.onYouTubeIframeAPIReady;
    const handleReady = () => {
      previousReady?.();
      setApiReady(Boolean(window.YT?.Player));
    };
    window.onYouTubeIframeAPIReady = handleReady;
    return () => {
      if (window.onYouTubeIframeAPIReady === handleReady) {
        window.onYouTubeIframeAPIReady = previousReady;
      }
    };
  }, []);

  React.useEffect(() => {
    const host = mountRef.current;
    const api = window.YT;
    if (!host || !apiReady || !api?.Player) return;
    const playerMount = document.createElement("div");
    playerMount.style.height = "100%";
    playerMount.style.width = "100%";
    host.replaceChildren(playerMount);

    const playerVars: Record<string, number | string> = {
      autoplay: 0,
      cc_load_policy: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      playsinline: 1,
      rel: 0,
    };
    if (playerOrigin) playerVars.origin = playerOrigin;

    playerRef.current = new api.Player(playerMount, {
      videoId: loadedVideoRef.current,
      host: "https://www.youtube-nocookie.com",
      height: "100%",
      width: "100%",
      playerVars,
      events: {
        onReady(event) {
          playerRef.current = event.target;
          readyRef.current = true;
          syncPlayer();
          onPlayerReadyRef.current();
          onVideoVisibleRef.current(loadedVideoRef.current);
          const iframe = event.target.getIframe();
          iframe.setAttribute("title", titleRef.current);
          iframe.setAttribute("tabindex", "-1");
        },
        onStateChange(event) {
          if (event.data === YOUTUBE_PLAYER_STATE_ENDED) {
            const endedVideoKey =
              event.target.getVideoData().video_id ?? loadedVideoRef.current;
            // The same iframe is reused across the feed, so an ENDED event
            // from the outgoing trailer must never restart beneath the next
            // slide. Menus, overlays, page visibility, and explicit Pause all
            // flow through shouldPlayRef and stop the loop as well.
            if (
              shouldPlayRef.current &&
              endedVideoKey === videoKeyRef.current &&
              endedVideoKey === loadedVideoRef.current
            ) {
              event.target.seekTo(0, true);
              event.target.playVideo();
            }
            return;
          }
          // 1 = playing, 3 = buffering. At either point the frame belongs to
          // the latest key and can replace its poster without flashing back.
          if (event.data === 1 || event.data === 3 || event.data === 5) {
            const visibleKey =
              event.target.getVideoData().video_id ?? loadedVideoRef.current;
            onVideoVisibleRef.current(visibleKey);
          }
        },
        onAutoplayBlocked() {
          onAutoplayBlockedRef.current();
        },
        onError() {
          onPlaybackErrorRef.current(loadedVideoRef.current);
        },
      },
    });

    return () => {
      const player = playerRef.current;
      readyRef.current = false;
      if (typeof player?.destroy === "function") player.destroy();
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [apiReady, playerOrigin, syncPlayer]);

  return (
    <>
      <Script
        id="slate-youtube-iframe-api"
        src="https://www.youtube.com/iframe_api"
        strategy="afterInteractive"
        onReady={() => setApiReady(Boolean(window.YT?.Player))}
        onError={() => onAutoplayBlockedRef.current()}
      />
      <div ref={mountRef} className="h-full min-h-[200px] w-full bg-black" />
    </>
  );
});
