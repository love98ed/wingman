"use client";

import { useEffect } from "react";

/** Plays each [data-reveal] / [data-shutter] entrance once, as its element scrolls into view. */
export function Reveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
    );
    document.querySelectorAll("[data-reveal], [data-shutter]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
