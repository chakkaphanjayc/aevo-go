export type AvatarDecorationId =
  | "none"
  | "lightstruck-halo"
  | "sakura-orbit"
  | "cyber-matrix"
  | "celestial-stardust"
  | "mystic-flame"
  | "emerald-bloom";

export type ProfileEffectId =
  | "none"
  | "prismatic-sheen"
  | "sakura-breeze"
  | "cyber-scan"
  | "cosmic-drift"
  | "champagne-sparkle";

export type BannerPresetId =
  | "obsidian-carbon"
  | "lightstruck-iridescent"
  | "midnight-tokyo"
  | "emerald-rainforest"
  | "celestial-cosmos"
  | "sunset-horizon"
  | "custom";

export type ThemeAccentId =
  | "obsidian-titanium"
  | "rose-quartz"
  | "arctic-cyan"
  | "champagne-gold"
  | "cyber-violet"
  | "emerald-sage";

export interface ProfileBadge {
  id: string;
  name: string;
  category: "tastemaker" | "progression" | "specialty" | "verified";
  description: string;
  iconKey: "badge-check" | "sparkles" | "compass" | "coffee" | "footprints" | "route";
}

export interface UserProfileCustomization {
  version: 1;
  userId: string;
  displayName: string;
  handle: string;
  bio: string;
  pronouns?: string;
  avatarUrl?: string | null;
  avatarDecorationId: AvatarDecorationId;
  bannerUrl?: string | null;
  bannerPresetId: BannerPresetId;
  profileEffectId: ProfileEffectId;
  themeAccentId: ThemeAccentId;
  activeBadges: string[];
  socialLinks: Array<{ id: string; platform: string; label: string; url: string }>;
  updatedAt: number;
}

export interface AvatarDecorationItem {
  id: AvatarDecorationId;
  name: string;
  description: string;
  tag: string;
  accentColor: string;
}

export interface ProfileEffectItem {
  id: ProfileEffectId;
  name: string;
  description: string;
  tag: string;
  accentColor: string;
}

export interface BannerPresetItem {
  id: BannerPresetId;
  name: string;
  description: string;
  gradient: string;
  borderTint: string;
}

export interface ThemeAccentItem {
  id: ThemeAccentId;
  name: string;
  primary: string;
  secondary: string;
  glow: string;
  bgGradient: string;
}

export const AVATAR_DECORATIONS: readonly AvatarDecorationItem[] = [
  {
    id: "none",
    name: "Classic Titanium",
    description: "ขอบไทเทเนียมและออร่าสะท้อนแสงแบบมินิมอล",
    tag: "Standard",
    accentColor: "rgba(255, 255, 255, 0.4)",
  },
  {
    id: "lightstruck-halo",
    name: "Light Struck Halo",
    description: "รัศมีฟอยล์เหลือบรุ้งสะท้อนแสงไข่มุกหมุนรอบตามแบบ Laura Mercier",
    tag: "Iridescent",
    accentColor: "#cfe1fd",
  },
  {
    id: "sakura-orbit",
    name: "Sakura Orbit",
    description: "กลีบซากุระสีชมพูอ่อนหมุนวนและโปรยปรายรอบอวาตาร์",
    tag: "Botanical",
    accentColor: "#fbcfe8",
  },
  {
    id: "cyber-matrix",
    name: "Cyber Glitch Matrix",
    description: "วงแหวนเทคโนไซไฟเรืองแสง พร้อมพัลส์กลิตช์นีออนสีฟ้า-ชมพู",
    tag: "Cyberpunk",
    accentColor: "#38bdf8",
  },
  {
    id: "celestial-stardust",
    name: "Celestial Stardust",
    description: "วงแหวนดวงดาวประกายเพชรในห้วงอวกาศสีม่วงคราม",
    tag: "Cosmic",
    accentColor: "#c084fc",
  },
  {
    id: "mystic-flame",
    name: "Mystic Flame Orb",
    description: "เปลวเพลิงเวทมนตร์สีฟ้าครามและม่วงลาเวนเดอร์พวยพุ่ง",
    tag: "Elemental",
    accentColor: "#818cf8",
  },
  {
    id: "emerald-bloom",
    name: "Emerald Bloom",
    description: "ใบไม้ธรรมชาติสีมรกตอ่อนพลิ้วไหวรอบกรอบอวาตาร์",
    tag: "Nature",
    accentColor: "#34d399",
  },
];

export const PROFILE_EFFECTS: readonly ProfileEffectItem[] = [
  {
    id: "none",
    name: "None",
    description: "การ์ดโปรไฟล์สไตล์ Dark Obsidian คมชัด สะอาดตา",
    tag: "Clean",
    accentColor: "rgba(255, 255, 255, 0.2)",
  },
  {
    id: "prismatic-sheen",
    name: "Prismatic Light Beam",
    description: "ลำแสงเหลือบรุ้งสะท้อนผิวฟอยล์พาดผ่านการ์ดโปรไฟล์เป็นระลอกคลื่น",
    tag: "Light Struck",
    accentColor: "#cfe1fd",
  },
  {
    id: "sakura-breeze",
    name: "Sakura Falling Breeze",
    description: "สายลมพัดพากลีบดอกซากุระลอยผ่านแบนเนอร์และข้อมูลโปรไฟล์",
    tag: "Atmospheric",
    accentColor: "#f472b6",
  },
  {
    id: "cyber-scan",
    name: "Cyberpunk Holo Grid",
    description: "เส้นสแกนฮอโลกราฟิกและอนุภาคข้อมูลเรืองแสงเคลื่อนที่ในแนวตั้ง",
    tag: "Sci-Fi",
    accentColor: "#06b6d4",
  },
  {
    id: "cosmic-drift",
    name: "Cosmic Galaxy Drift",
    description: "เนบิวลาดาวฤกษ์และละอองฝุ่นอวกาศกะพริบระยิบระยับช้าๆ",
    tag: "Galaxy",
    accentColor: "#a855f7",
  },
  {
    id: "champagne-sparkle",
    name: "Champagne Starlight",
    description: "ประกายเกล็ดทองคำแชมเปญลอยขึ้นแบบละมุนตา มอบสัมผัสหรูหรา",
    tag: "Luxury",
    accentColor: "#fbbf24",
  },
];

export const BANNER_PRESETS: readonly BannerPresetItem[] = [
  {
    id: "obsidian-carbon",
    name: "Obsidian Titanium",
    description: "คาร์บอนไฟเบอร์สีดำเข้มพร้อมไฮไลต์โลหะด้าน",
    gradient: "linear-gradient(135deg, #090b0e 0%, #151a22 50%, #0d1015 100%)",
    borderTint: "rgba(255, 255, 255, 0.12)",
  },
  {
    id: "lightstruck-iridescent",
    name: "Light Struck Iridescent",
    description: "การกระจายแสงสีขาวนวลเหลือบรุ้งพาสเทลแบบฟอยล์สะท้อนแสง",
    gradient: "linear-gradient(135deg, #101520 0%, #171d2b 35%, #241d28 70%, #151a24 100%)",
    borderTint: "rgba(207, 225, 253, 0.35)",
  },
  {
    id: "midnight-tokyo",
    name: "Midnight Tokyo",
    description: "บรรยากาศเมืองยามค่ำคืน โทนสีน้ำเงินครามและม่วงนีออนละมุน",
    gradient: "linear-gradient(135deg, #0b111e 0%, #181938 50%, #20132b 100%)",
    borderTint: "rgba(129, 140, 248, 0.35)",
  },
  {
    id: "emerald-rainforest",
    name: "Emerald Rainforest",
    description: "โทนป่าเขียวขจีลึกซึ้ง เหมาะกับสายเดินธรรมชาติและคาเฟ่ต้นไม้",
    gradient: "linear-gradient(135deg, #071510 0%, #0e241c 50%, #081a13 100%)",
    borderTint: "rgba(52, 211, 153, 0.3)",
  },
  {
    id: "celestial-cosmos",
    name: "Celestial Deep Cosmos",
    description: "ห้วงอวกาศสีม่วงดำลึกลับ เสมือนมองผ่านกล้องดูดาว",
    gradient: "linear-gradient(135deg, #0e0a1a 0%, #1c1432 50%, #120b22 100%)",
    borderTint: "rgba(192, 132, 252, 0.35)",
  },
  {
    id: "sunset-horizon",
    name: "Golden Sunset Horizon",
    description: "แสงอาทิตย์อัสดงสีพีชชมพูและทองคำอ่อน ให้ความอบอุ่น",
    gradient: "linear-gradient(135deg, #1f1118 0%, #2a161f 45%, #201712 100%)",
    borderTint: "rgba(244, 114, 182, 0.3)",
  },
];

export const THEME_ACCENTS: readonly ThemeAccentItem[] = [
  {
    id: "obsidian-titanium",
    name: "Obsidian Titanium (Default)",
    primary: "#ffffff",
    secondary: "#94a3b8",
    glow: "rgba(255, 255, 255, 0.15)",
    bgGradient: "linear-gradient(180deg, #12161c 0%, #090b0e 100%)",
  },
  {
    id: "rose-quartz",
    name: "Rose Quartz & Peach",
    primary: "#f472b6",
    secondary: "#fbcfe8",
    glow: "rgba(244, 114, 182, 0.25)",
    bgGradient: "linear-gradient(180deg, #191218 0%, #0d090d 100%)",
  },
  {
    id: "arctic-cyan",
    name: "Arctic Cyan & Pearl",
    primary: "#38bdf8",
    secondary: "#bae6fd",
    glow: "rgba(56, 189, 248, 0.25)",
    bgGradient: "linear-gradient(180deg, #0f1722 0%, #090e16 100%)",
  },
  {
    id: "champagne-gold",
    name: "Champagne Gold Pearl",
    primary: "#fbbf24",
    secondary: "#fde68a",
    glow: "rgba(251, 191, 36, 0.25)",
    bgGradient: "linear-gradient(180deg, #1a1710 0%, #0f0d09 100%)",
  },
  {
    id: "cyber-violet",
    name: "Cyberpunk Violet",
    primary: "#c084fc",
    secondary: "#e9d5ff",
    glow: "rgba(192, 132, 252, 0.25)",
    bgGradient: "linear-gradient(180deg, #171124 0%, #0d0916 100%)",
  },
  {
    id: "emerald-sage",
    name: "Emerald Sage",
    primary: "#34d399",
    secondary: "#a7f3d0",
    glow: "rgba(52, 211, 153, 0.25)",
    bgGradient: "linear-gradient(180deg, #0e1814 0%, #080f0c 100%)",
  },
];

export const PROFILE_BADGES_CATALOG: readonly ProfileBadge[] = [
  {
    id: "badge-founding-tastemaker",
    name: "Founding Tastemaker",
    category: "tastemaker",
    description: "ผู้สร้างสรรค์เส้นทางรุ่นบุกเบิกของ Aevocado GO",
    iconKey: "sparkles",
  },
  {
    id: "badge-verified-curator",
    name: "Verified Curator",
    category: "verified",
    description: "ผ่านการรับรองคุณภาพการคัดสรรรอยเท้าและสถานที่",
    iconKey: "badge-check",
  },
  {
    id: "badge-coffee-specialist",
    name: "Coffee Specialist",
    category: "specialty",
    description: "มีความเชี่ยวชาญด้าน Specialty Coffee และกาแฟทางเลือก",
    iconKey: "coffee",
  },
  {
    id: "badge-urban-flaneur",
    name: "Urban Flâneur",
    category: "progression",
    description: "นักสำรวจเมืองเท้าเปล่า เก็บก้าวเดินในเมืองมากกว่า 100 กิโลเมตร",
    iconKey: "footprints",
  },
  {
    id: "badge-trailblazer",
    name: "Trailblazer Lv.5",
    category: "progression",
    description: "สร้างและเผยแพร่ Trace คุณภาพสูงมากกว่า 10 เส้นทาง",
    iconKey: "route",
  },
];

export const AVATAR_PRESETS: readonly { id: string; name: string; url: string }[] = [
  {
    id: "avatar-pearl-minimal",
    name: "Pearl Minimalist",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80",
  },
  {
    id: "avatar-coffee-artisan",
    name: "Coffee Artisan",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80",
  },
  {
    id: "avatar-urban-designer",
    name: "Urban Designer",
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80",
  },
  {
    id: "avatar-travel-photographer",
    name: "Tokyo Traveler",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80",
  },
];
