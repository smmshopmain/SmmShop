import {
  Activity,
  Bell,
  Boxes,
  CircleDollarSign,
  Camera,
  Compass,
  CreditCard,
  Gauge,
  Headphones,
  Heart,
  Link,
  MessageSquare,
  Music2,
  Package,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const LOADING_ANIMATIONS: Array<{ id: string; label: string; Icon: LucideIcon }> = [
  { id: "service-orbit", label: "Service Orbit", Icon: Boxes },
  { id: "order-pulse", label: "Order Pulse", Icon: ShoppingCart },
  { id: "wallet-wave", label: "Wallet Wave", Icon: CreditCard },
  { id: "coin-spin", label: "Coin Spin", Icon: CircleDollarSign },
  { id: "social-bounce", label: "Social Bounce", Icon: Users },
  { id: "growth-rise", label: "Growth Rise", Icon: TrendingUp },
  { id: "message-pop", label: "Message Pop", Icon: MessageSquare },
  { id: "support-beat", label: "Support Beat", Icon: Headphones },
  { id: "notification-ring", label: "Notification Ring", Icon: Bell },
  { id: "link-flow", label: "Link Flow", Icon: Link },
  { id: "music-equalizer", label: "Music Equalizer", Icon: Music2 },
  { id: "social-heart", label: "Social Heart", Icon: Heart },
  { id: "secure-shield", label: "Secure Shield", Icon: ShieldCheck },
  { id: "delivery-route", label: "Delivery Route", Icon: Send },
  { id: "package-turn", label: "Package Turn", Icon: Package },
  { id: "dashboard-gauge", label: "Dashboard Gauge", Icon: Gauge },
  { id: "discovery-compass", label: "Discovery Compass", Icon: Compass },
  { id: "instagram-flash", label: "Social Flash", Icon: Camera },
  { id: "activity-scan", label: "Activity Scan", Icon: Activity },
  { id: "sparkle-shimmer", label: "Sparkle Shimmer", Icon: Sparkles },
];

export const DEFAULT_ENABLED_LOADING_ANIMATIONS = LOADING_ANIMATIONS.map(({ id }) => id);

let lastRandomAnimationId = "";

export function chooseRandomLoadingAnimation(enabledIds: string[]) {
  const candidates = enabledIds.length > 1
    ? enabledIds.filter((id) => id !== lastRandomAnimationId)
    : enabledIds;
  const pool = candidates.length ? candidates : DEFAULT_ENABLED_LOADING_ANIMATIONS;
  lastRandomAnimationId = pool[Math.floor(Math.random() * pool.length)];
  return lastRandomAnimationId;
}
