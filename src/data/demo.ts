export interface StoreSummary {
  id?: string;
  slug: string;
  /** Optional canonical identifiers used when a demo fixture is promoted to live data. */
  publicStoreCode?: string;
  venueSlug?: string;
  publicBookingRoute?: string | null;
  isAevoPlayPartner?: boolean;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mediaUrls?: string[];
  facilities?: string[];
  policySummary?: string | null;
  address?: string | null;
  timezone?: string;
  operatingHours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; enabled: boolean }>;
  name: string;
  area: string;
  category: string;
  rating: number | null;
  reviewCount: number;
  priceRange: string;
  availability: string;
  availableToday?: boolean | null;
  priceLevel?: number | null;
  categoryIconKey?: string;
  distanceMeters?: number;
  description: string;
  accent: "mint" | "blue" | "amber";
}

export const categories = ["Cafe", "Dining", "Wellness", "Activities", "Stay"] as const;
export const areas = [
  "ใกล้ฉัน",
  "Ari",
  "Thonglor",
  "Sathorn",
  "Charoenkrung",
  "Siam",
  "Yaowarat",
  "Old Town",
] as const;

export const demoStores: StoreSummary[] = [
  {
    slug: "north-star-coffee",
    name: "North Star Coffee",
    area: "Ari",
    category: "Cafe",
    rating: 4.8,
    reviewCount: 214,
    priceRange: "฿฿",
    availability: "จองผ่าน Aevo Play ได้วันนี้",
    venueSlug: "north-star-coffee",
    isAevoPlayPartner: true,
    description: "Slow coffee, quiet corners and a bright morning menu.",
    accent: "mint"
  },
  {
    slug: "sora-table",
    name: "Sora Table",
    area: "Thonglor",
    category: "Dining",
    rating: 4.7,
    reviewCount: 156,
    priceRange: "฿฿฿",
    availability: "จองผ่าน Aevo Play ได้ 19:30",
    venueSlug: "sora-table",
    isAevoPlayPartner: true,
    description: "Seasonal plates built around local ingredients and open fire.",
    accent: "blue"
  },
  {
    slug: "calm-house-studio",
    name: "Calm House Studio",
    area: "Sathorn",
    category: "Wellness",
    rating: 4.9,
    reviewCount: 92,
    priceRange: "฿฿",
    availability: "จองผ่าน Aevo Play ได้พรุ่งนี้",
    venueSlug: "calm-house-studio",
    isAevoPlayPartner: true,
    description: "A small studio for restorative movement and focused practice.",
    accent: "amber"
  },
  {
    slug: "talat-noi-roastery",
    name: "Talat Noi Roastery",
    area: "Charoenkrung",
    category: "Cafe",
    rating: 4.8,
    reviewCount: 128,
    priceRange: "฿฿",
    availability: "จองผ่าน Aevo Play ได้ 10:30",
    venueSlug: "talat-noi-roastery",
    isAevoPlayPartner: true,
    description: "กาแฟคั่วเล็ก ๆ ในย่านเก่าที่เดินต่อไปยังแกลเลอรีได้",
    accent: "mint",
  },
  {
    slug: "chao-phraya-table",
    name: "Chao Phraya Table",
    area: "Charoenkrung",
    category: "Dining",
    rating: 4.6,
    reviewCount: 87,
    priceRange: "฿฿฿",
    availability: "จองผ่าน Aevo Play ได้ 18:00",
    venueSlug: "chao-phraya-table",
    isAevoPlayPartner: true,
    description: "อาหารไทยร่วมสมัยกับวิวริมน้ำและช่วงเย็นที่ไม่เร่งรีบ",
    accent: "blue",
  },
  {
    slug: "siam-discovery-hall",
    name: "Siam Discovery Hall",
    area: "Siam",
    category: "Activities",
    rating: 4.5,
    reviewCount: 64,
    priceRange: "฿฿",
    availability: "เปิดวันนี้ · walk-in",
    description: "พื้นที่จัดแสดงและกิจกรรมสร้างสรรค์ใจกลางเมือง",
    accent: "amber",
  },
  {
    slug: "yaowarat-night-food",
    name: "Yaowarat Night Food",
    area: "Yaowarat",
    category: "Dining",
    rating: 4.4,
    reviewCount: 342,
    priceRange: "฿",
    availability: "เปิดวันนี้ · walk-in",
    description: "เส้นทางอาหารกลางคืนสำหรับคนที่อยากชิมหลายร้านในระยะเดิน",
    accent: "blue",
  },
  {
    slug: "ari-ceramic-house",
    name: "Ari Ceramic House",
    area: "Ari",
    category: "Activities",
    rating: 4.7,
    reviewCount: 73,
    priceRange: "฿฿",
    availability: "จองผ่าน Aevo Play ได้ 14:00",
    venueSlug: "ari-ceramic-house",
    isAevoPlayPartner: true,
    description: "เวิร์กช็อปเซรามิกขนาดเล็กสำหรับช่วงบ่ายที่อยากทำอะไรด้วยมือ",
    accent: "mint",
  }
];

export function getStore(slug: string | undefined): StoreSummary | undefined {
  return demoStores.find((store) => store.slug === slug);
}
