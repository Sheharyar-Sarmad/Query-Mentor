"use client";

import * as React from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface HeroTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export function HeroText({ text, className, delay = 0 }: HeroTextProps) {
  const container = React.useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (!container.current) return;

      const chars = container.current.querySelectorAll<HTMLElement>(".char");
      if (!chars.length) return;

      gsap.set(chars, { yPercent: 100, opacity: 0 });

      gsap.to(chars, {
        yPercent: 0,
        opacity: 1,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.025,
        delay,
      });
    },
    { scope: container },
  );

  // Split text into per-character spans, preserving spaces
  const words = text.split(" ");

  return (
    <span ref={container} className={className} aria-label={text}>
      {words.map((word, wi) => (
        <span
          key={wi}
          aria-hidden
          className="inline-block overflow-hidden align-bottom"
          style={{ paddingBottom: "0.1em" }}
        >
          {Array.from(word).map((ch, ci) => (
            <span key={ci} className="char inline-block">
              {ch}
            </span>
          ))}
          {wi < words.length - 1 && (
            <span className="char inline-block">&nbsp;</span>
          )}
        </span>
      ))}
    </span>
  );
}