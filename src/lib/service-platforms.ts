export const SERVICE_PLATFORMS = [
  {
    id: "telegram",
    label: "Telegram",
    keywords: ["telegram"],
  },
  {
    id: "spotify",
    label: "Spotify",
    keywords: ["spotify"],
  },
  {
    id: "instagram",
    label: "Instagram",
    keywords: ["instagram"],
  },
  {
    id: "x",
    label: "X",
    keywords: ["twitter", "x.com"],
  },
  {
    id: "facebook",
    label: "Facebook",
    keywords: ["facebook"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    keywords: ["tiktok", "tik tok"],
  },
  {
    id: "youtube",
    label: "YouTube",
    keywords: ["youtube"],
  },
  {
    id: "website",
    label: "Website",
    keywords: ["website", "web traffic", "traffic", "seo"],
  },
  {
    id: "snapchat",
    label: "Snapchat",
    keywords: ["snapchat"],
  },
  {
    id: "twitch",
    label: "Twitch",
    keywords: ["twitch"],
  },
  {
    id: "kwai",
    label: "Kwai",
    keywords: ["kwai", "kuaishou"],
  },
  {
    id: "tidal",
    label: "Tidal",
    keywords: ["tidal"],
  },
  {
    id: "soundcloud",
    label: "SoundCloud",
    keywords: ["soundcloud", "sound cloud"],
  },
  {
    id: "shazam",
    label: "Shazam",
    keywords: ["shazam"],
  },
  {
    id: "rumble",
    label: "Rumble",
    keywords: ["rumble"],
  },
  {
    id: "quora",
    label: "Quora",
    keywords: ["quora"],
  },
  {
    id: "pinterest",
    label: "Pinterest",
    keywords: ["pinterest"],
  },
  {
    id: "odnoklassniki",
    label: "OK",
    keywords: ["odnoklassniki", "ok.ru"],
  },
  {
    id: "apple-music",
    label: "Apple Music",
    keywords: ["apple music", "itunes"],
  },
  {
    id: "audiomack",
    label: "Audiomack",
    keywords: ["audiomack"],
  },
  {
    id: "discord",
    label: "Discord",
    keywords: ["discord"],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    keywords: ["linkedin", "linked in"],
  },
] as const;

export type ServicePlatformId = (typeof SERVICE_PLATFORMS)[number]["id"];
export type ServicePlatform = (typeof SERVICE_PLATFORMS)[number];

export function getServicePlatform(id: string | null | undefined) {
  return SERVICE_PLATFORMS.find((platform) => platform.id === id);
}
