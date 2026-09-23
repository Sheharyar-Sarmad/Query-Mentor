"use client";

import * as React from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface StatCounterProps {
  value: number;
  suffix?: string;
  className?: string;
}

export function StatCounter({ value, suffix = "", className }: StatCounterProps) {
  const ref = React.useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    if (!ref.current) return;

    const obj = { val: 0 };

    gsap.to(obj, {
      val: value,
      duration: 1.6,
      ease: "power2.out",
      snap: { val: 1 },
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = Math.round(obj.val).toString() + suffix;
        }
      },
      scrollTrigger: {
        trigger: ref.current,
        start: "top 85%",
        once: true,
      },
    });
  }, { dependencies: [value] });

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  );
}