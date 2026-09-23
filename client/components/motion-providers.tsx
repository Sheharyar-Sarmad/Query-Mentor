"use client";

import * as React from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";

export function MotionProviders({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <AnimatePresence mode="wait">{children}</AnimatePresence>
    </MotionConfig>
  );
}