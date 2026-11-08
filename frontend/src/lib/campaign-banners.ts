export const CAMPAIGN_BANNER_PRESETS = [
  { id: "diwali", name: "Diwali", emoji: "🪔", colors: ["#7c2d12", "#f59e0b"], title: "Happy Diwali" },
  { id: "holi", name: "Holi", emoji: "🎨", colors: ["#be185d", "#7c3aed"], title: "Happy Holi" },
  { id: "eid-al-fitr", name: "Eid al-Fitr", emoji: "🌙", colors: ["#065f46", "#0f766e"], title: "Eid Mubarak" },
  { id: "eid-al-adha", name: "Eid al-Adha", emoji: "🌙", colors: ["#134e4a", "#15803d"], title: "Eid Mubarak" },
  { id: "christmas", name: "Christmas", emoji: "🎄", colors: ["#991b1b", "#166534"], title: "Merry Christmas" },
  { id: "new-year", name: "New Year", emoji: "🎆", colors: ["#312e81", "#7c3aed"], title: "Happy New Year" },
  { id: "independence-day", name: "Independence Day", emoji: "🇮🇳", colors: ["#c2410c", "#047857"], title: "Happy Independence Day" },
  { id: "republic-day", name: "Republic Day", emoji: "🇮🇳", colors: ["#ea580c", "#047857"], title: "Happy Republic Day" },
  { id: "raksha-bandhan", name: "Raksha Bandhan", emoji: "🪷", colors: ["#9d174d", "#c2410c"], title: "Happy Raksha Bandhan" },
  { id: "navratri", name: "Navratri", emoji: "💃", colors: ["#9f1239", "#6d28d9"], title: "Happy Navratri" },
  { id: "dussehra", name: "Dussehra", emoji: "🏹", colors: ["#9a3412", "#b91c1c"], title: "Happy Dussehra" },
  { id: "durga-puja", name: "Durga Puja", emoji: "🌺", colors: ["#9d174d", "#ea580c"], title: "Shubho Durga Puja" },
  { id: "ganesh-chaturthi", name: "Ganesh Chaturthi", emoji: "🐘", colors: ["#9a3412", "#c2410c"], title: "Ganpati Bappa Morya" },
  { id: "janmashtami", name: "Janmashtami", emoji: "🦚", colors: ["#1e3a8a", "#6d28d9"], title: "Happy Janmashtami" },
  { id: "onam", name: "Onam", emoji: "🌼", colors: ["#166534", "#ca8a04"], title: "Happy Onam" },
  { id: "pongal", name: "Pongal", emoji: "🌾", colors: ["#854d0e", "#15803d"], title: "Happy Pongal" },
  { id: "baisakhi", name: "Baisakhi", emoji: "🌾", colors: ["#a16207", "#b91c1c"], title: "Happy Baisakhi" },
  { id: "makar-sankranti", name: "Makar Sankranti", emoji: "🪁", colors: ["#c2410c", "#1d4ed8"], title: "Happy Makar Sankranti" },
  { id: "lohri", name: "Lohri", emoji: "🔥", colors: ["#9a3412", "#b91c1c"], title: "Happy Lohri" },
  { id: "karwa-chauth", name: "Karwa Chauth", emoji: "🌕", colors: ["#9f1239", "#be185d"], title: "Happy Karwa Chauth" },
  { id: "guru-nanak-jayanti", name: "Guru Nanak Jayanti", emoji: "🪯", colors: ["#1e40af", "#15803d"], title: "Happy Gurpurab" },
  { id: "buddha-purnima", name: "Buddha Purnima", emoji: "🪷", colors: ["#047857", "#ca8a04"], title: "Peace & Blessings" },
  { id: "mahavir-jayanti", name: "Mahavir Jayanti", emoji: "🙏", colors: ["#a16207", "#047857"], title: "Peace & Blessings" },
  { id: "easter", name: "Easter", emoji: "🐣", colors: ["#7e22ce", "#db2777"], title: "Happy Easter" },
  { id: "thanksgiving", name: "Thanksgiving", emoji: "🍂", colors: ["#9a3412", "#a16207"], title: "Happy Thanksgiving" },
] as const;

export type CampaignBannerPresetId = (typeof CAMPAIGN_BANNER_PRESETS)[number]["id"];

export type CampaignBanner = {
  presetId: CampaignBannerPresetId | null;
  imageUrl: string;
  backgroundImageUrl: string;
  backgroundColor: string;
};
