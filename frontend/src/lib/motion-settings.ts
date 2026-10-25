import { DEFAULT_ENABLED_LOADING_ANIMATIONS, LOADING_ANIMATIONS } from "@/lib/loading-animations";

export type MotionSettings = {
  designPreset: "default" | "studio" | "orbit" | "atelier" | "pulse" | "midnight";
  animationsEnabled: boolean;
  entranceEnabled: boolean;
  floatingEnabled: boolean;
  hoverEnabled: boolean;
  animationColor: string;
  animationSpeed: number;
  loadingAnimationsEnabled: boolean;
  loadingAnimationMode: "random" | "specific";
  selectedLoadingAnimation: string;
  enabledLoadingAnimations: string[];
};

export const DESIGN_MOTION_COLORS: Record<MotionSettings["designPreset"], string> = {
  default: "#0f766e",
  studio: "#0f8a82",
  orbit: "#7048ef",
  atelier: "#b94e35",
  pulse: "#67e8d0",
  midnight: "#818cf8",
};

export const DEFAULT_MOTION_SETTINGS: MotionSettings = {
  designPreset: "default",
  animationsEnabled: true,
  entranceEnabled: true,
  floatingEnabled: true,
  hoverEnabled: true,
  animationColor: DESIGN_MOTION_COLORS.default,
  animationSpeed: 1,
  loadingAnimationsEnabled: true,
  loadingAnimationMode: "random",
  selectedLoadingAnimation: "service-orbit",
  enabledLoadingAnimations: DEFAULT_ENABLED_LOADING_ANIMATIONS,
};

export function normalizeMotionSettings(value: Partial<MotionSettings>): MotionSettings {
  const validIds = new Set(LOADING_ANIMATIONS.map(({ id }) => id));
  const configuredIds = Array.isArray(value.enabledLoadingAnimations)
    ? [...new Set(value.enabledLoadingAnimations.filter((id): id is string => typeof id === "string" && validIds.has(id)))]
    : DEFAULT_ENABLED_LOADING_ANIMATIONS;
  const enabledLoadingAnimations = configuredIds.length > 0
    ? configuredIds
    : DEFAULT_ENABLED_LOADING_ANIMATIONS;
  const requestedSelection = value.selectedLoadingAnimation;
  const designPreset = typeof value.designPreset === "string"
    && Object.hasOwn(DESIGN_MOTION_COLORS, value.designPreset)
    ? value.designPreset
    : DEFAULT_MOTION_SETTINGS.designPreset;

  return {
    ...DEFAULT_MOTION_SETTINGS,
    ...value,
    designPreset,
    animationColor: DESIGN_MOTION_COLORS[designPreset],
    loadingAnimationMode: value.loadingAnimationMode === "specific" ? "specific" : "random",
    selectedLoadingAnimation: typeof requestedSelection === "string" && enabledLoadingAnimations.includes(requestedSelection)
      ? requestedSelection
      : enabledLoadingAnimations[0],
    enabledLoadingAnimations,
  };
}
