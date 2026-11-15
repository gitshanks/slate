"use client";

import * as React from "react";

const FADE: KeyframeAnimationOptions = {
  duration: 280,
  easing: "cubic-bezier(0.33, 1, 0.68, 1)",
};
const FADE_REDUCED: KeyframeAnimationOptions = { duration: 140, easing: "ease-out" };

/**
 * Makes every image in the app arrive softly. An image that is still
 * downloading when it enters the page is held invisible, then faded in once
 * it has loaded and decoded, so posters, backdrops and avatars never pop in
 * mid-frame. An image that is already available (cached, or loaded before the
 * app started) is left alone and simply appears with its screen.
 *
 * It works on the elements themselves through the Web Animations API, so it
 * adds no attributes or classes for React to disagree with, and it leaves an
 * image's own opacity, hover and transition styles untouched: the fade ends
 * at whatever opacity the image is styled to have.
 *
 * Opt an image (or a whole subtree) out with `data-image-arrival="off"` when
 * it runs its own loading transition.
 */
export function ImageArrival() {
  React.useEffect(() => {
    if (typeof Element.prototype.animate !== "function") return;

    const holds = new WeakMap<HTMLImageElement, Animation>();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const hold = (image: HTMLImageElement) => {
      if (holds.has(image)) return;
      if (image.complete || !image.currentSrc && !image.src && !image.srcset) return;
      if (image.closest('[data-image-arrival="off"]')) return;
      holds.set(
        image,
        image.animate([{ opacity: 0 }, { opacity: 0 }], {
          duration: 1,
          fill: "forwards",
        }),
      );
    };

    const release = (image: HTMLImageElement, fade: boolean) => {
      const held = holds.get(image);
      if (!held) return;
      holds.delete(image);
      if (!fade) {
        held.cancel();
        return;
      }
      const show = () => {
        // The fade starts before the hold is dropped, so no frame shows the
        // image at full strength in between.
        image.animate([{ opacity: 0 }, {}], reduce.matches ? FADE_REDUCED : FADE);
        held.cancel();
      };
      // Wait for the pixels, not just the bytes, or the fade plays over an
      // image that only appears part-way through it.
      if (typeof image.decode === "function") image.decode().then(show, show);
      else show();
    };

    const scan = (node: Node) => {
      if (node instanceof HTMLImageElement) hold(node);
      else if (node instanceof Element) {
        node.querySelectorAll("img").forEach(hold);
      }
    };

    const onLoad = (event: Event) => {
      if (event.target instanceof HTMLImageElement) release(event.target, true);
    };
    const onError = (event: Event) => {
      if (event.target instanceof HTMLImageElement) release(event.target, false);
    };

    // Load and error do not bubble, but they can be caught on the way down.
    document.addEventListener("load", onLoad, true);
    document.addEventListener("error", onError, true);
    const observer = new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach(scan);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scan(document.body);

    return () => {
      observer.disconnect();
      document.removeEventListener("load", onLoad, true);
      document.removeEventListener("error", onError, true);
    };
  }, []);

  return null;
}
