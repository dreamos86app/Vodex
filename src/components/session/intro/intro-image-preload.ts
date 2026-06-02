import { INTRO_CINEMATIC_APPS } from "@/components/session/intro/intro-apps";

let preloadStarted = false;

/** Eagerly fetch intro PNGs so panels never flash empty on first paint. */
export function preloadIntroReferenceImages(): void {
  if (typeof window === "undefined" || preloadStarted) return;
  preloadStarted = true;

  for (const app of INTRO_CINEMATIC_APPS) {
    const img = new window.Image();
    img.decoding = "async";
    img.src = app.imageSrc;
  }

  for (const app of INTRO_CINEMATIC_APPS) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = app.imageSrc;
    document.head.appendChild(link);
  }
}
