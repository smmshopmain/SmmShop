"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { chooseRandomLoadingAnimation, DEFAULT_ENABLED_LOADING_ANIMATIONS, LOADING_ANIMATIONS } from "@/lib/loading-animations";
import { useMotionSettings } from "@/components/motion-settings-provider";

export function ContentLoading({
  label = "Loading content",
  animationId,
  compact = false,
}: {
  label?: string;
  animationId?: string;
  compact?: boolean;
}) {
  const { settings } = useMotionSettings();
  const [randomAnimation, setRandomAnimation] = useState("");
  const enabled = settings.enabledLoadingAnimations.length
    ? settings.enabledLoadingAnimations
    : DEFAULT_ENABLED_LOADING_ANIMATIONS;
  const activeSelection = enabled.includes(settings.selectedLoadingAnimation)
    ? settings.selectedLoadingAnimation
    : enabled[0];
  const activeRandomAnimation = enabled.includes(randomAnimation)
    ? randomAnimation
    : enabled[0];
  const selectedId = animationId
    ?? (settings.loadingAnimationMode === "specific"
      ? activeSelection
      : activeRandomAnimation);
  const animation = LOADING_ANIMATIONS.find(({ id }) => id === selectedId)
    ?? LOADING_ANIMATIONS.find(({ id }) => enabled.includes(id))
    ?? LOADING_ANIMATIONS[0];
  const Icon = animation.Icon;
  const isAnimated = settings.animationsEnabled && settings.loadingAnimationsEnabled;

  useEffect(() => {
    if (animationId || settings.loadingAnimationMode !== "random") return;
    const choices = enabled.length ? enabled : DEFAULT_ENABLED_LOADING_ANIMATIONS;
    const timeout = window.setTimeout(() => {
      setRandomAnimation(chooseRandomLoadingAnimation(choices));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [animationId, enabled, settings.loadingAnimationMode]);

  return (
    <div
      className={`content-loading ${compact ? "content-loading-compact" : ""}`}
      role="status"
      aria-label={label}
      aria-live="polite"
      style={{ "--loading-accent": settings.animationColor } as CSSProperties & { "--loading-accent": string }}
    >
      <span className={`content-loading-icon loading-${animation.id}${isAnimated ? "" : " content-loading-static"}`}>
        <Icon aria-hidden="true" />
      </span>
      <span className="content-loading-label">{label}</span>
      <span className="sr-only">{animation.label}</span>
    </div>
  );
}
