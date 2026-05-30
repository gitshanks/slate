"use client";

import * as React from "react";

// The Web Speech API isn't in TypeScript's DOM lib (and ships under the
// `webkit` prefix in Safari/Chrome), so we declare the slice we use.

interface SpeechAlternativeLike {
  readonly transcript: string;
}
interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternativeLike;
}
interface SpeechResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechResultLike;
}
interface SpeechRecognitionEventLike {
  readonly results: SpeechResultListLike;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Options {
  /** Called with the running transcript; `isFinal` flips true on the last result. */
  onResult: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  lang?: string;
}

/**
 * Thin React wrapper over the Web Speech API for one-shot dictation. Returns
 * `supported: false` (so callers can hide the mic) when the browser lacks it —
 * e.g. Firefox, and some iOS PWA contexts. A single utterance: it stops on its
 * own when the speaker pauses, surfacing interim text along the way.
 */
export function useSpeechRecognition({ onResult, onEnd, lang }: Options) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const recRef = React.useRef<SpeechRecognitionLike | null>(null);

  // Keep the latest callbacks without forcing `start` to be recreated.
  const onResultRef = React.useRef(onResult);
  const onEndRef = React.useRef(onEnd);
  React.useEffect(() => {
    onResultRef.current = onResult;
    onEndRef.current = onEnd;
  });

  React.useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  const stop = React.useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang =
      lang ||
      (typeof navigator !== "undefined" ? navigator.language : "") ||
      "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0]?.transcript ?? "";
      }
      const last = e.results[e.results.length - 1];
      onResultRef.current(transcript.trim(), last?.isFinal ?? false);
    };
    rec.onerror = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      onEndRef.current?.();
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      // start() throws if already started — reset state and bail.
      setListening(false);
      recRef.current = null;
    }
  }, [lang]);

  const toggle = React.useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  return { supported, listening, start, stop, toggle };
}
