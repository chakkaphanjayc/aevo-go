import type {
  DiscoveryComment,
  DiscoveryItem,
  DiscoveryPlace,
  DiscoveryPost,
  DiscoveryTrace,
  DiscoveryTracer,
} from "./types";

const mookCommenter = {
  id: "commenter-mook",
  name: "Mook",
  initials: "MK",
  bio: "ชอบกาแฟที่มี character และเส้นทางที่เดินต่อได้จริง",
  area: "Ari",
  expertise: ["กาแฟ", "photo walk"],
  tasteMatchLabel: "91%",
  following: false,
} as const;

const kenCommenter = {
  id: "commenter-ken",
  name: "Ken",
  initials: "KN",
  bio: "เก็บรายละเอียดเล็ก ๆ ของย่านเก่าและร้านที่มีเรื่องเล่า",
  area: "Old Town",
  expertise: ["ย่านเก่า", "เดินเมือง"],
  tasteMatchLabel: "86%",
  following: false,
} as const;

const ninaCommenter = {
  id: "commenter-nina",
  name: "Nina",
  initials: "NN",
  bio: "นักเดินทางสายช้า ชอบแวะ gallery และร้านหนังสือ",
  area: "Old Town",
  expertise: ["art gallery", "หนังสือ"],
  tasteMatchLabel: "82%",
  following: false,
} as const;

const ariComments: DiscoveryComment[] = [
  {
    id: "comment-ari-1",
    authorId: mookCommenter.id,
    authorName: "Mook",
    authorInitials: "MK",
    authorProfile: mookCommenter,
    body: "ช่วงเช้าแสงดีมาก และเดินต่อได้สบาย",
    createdAt: "วันนี้",
  },
];

const oldTownComments: DiscoveryComment[] = [
  {
    id: "comment-old-town-1",
    authorId: kenCommenter.id,
    authorName: "Ken",
    authorInitials: "KN",
    authorProfile: kenCommenter,
    body: "Stop 3 ใช้เวลานานกว่าที่คิดนิดหน่อย แต่คุ้มมาก",
    createdAt: "เมื่อวาน",
  },
  {
    id: "comment-old-town-2",
    authorId: ninaCommenter.id,
    authorName: "Nina",
    authorInitials: "NN",
    authorProfile: ninaCommenter,
    body: "ขอบคุณสำหรับโน้ตเรื่องทางเดิน",
    createdAt: "เมื่อวาน",
    parentId: "comment-old-town-1",
  },
];

const ariTracer = {
  id: "tracer-ari",
  name: "Mina P.",
  initials: "MP",
  expertise: ["กาแฟ", "งานออกแบบ"],
  area: "Ari",
  following: true,
} as const;

const oldTownTracer = {
  id: "tracer-old-town",
  name: "Tee R.",
  initials: "TR",
  expertise: ["ย่านเก่า", "photo walk"],
  area: "Old Town",
  following: false,
} as const;

export const demoTraces: DiscoveryTrace[] = [
  {
    id: "trace-ari-design",
    itemType: "TRACE",
    slug: "ari-design-morning",
    title: "Ari เช้าเบา ๆ กับกาแฟและงานออกแบบ",
    description:
      "เส้นทางครึ่งวันที่เริ่มจากกาแฟดี ๆ แล้วค่อยเดินดูสตูดิโอเล็ก ๆ ในย่าน Ari",
    area: "Ari",
    creator: ariTracer,
    coverTiles: ["AR", "CO", "DE"],
    coverImages: [
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=82",
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=82",
      "https://images.unsplash.com/photo-1523726491678-bf852e717f6a?auto=format&fit=crop&w=900&q=82",
    ],
    topicTags: ["กาแฟ", "งานออกแบบ"],
    stopCount: 5,
    durationMinutes: 180,
    distanceKm: 2.4,
    budgetLabel: "฿฿",
    followerCount: 32,
    remixCount: 8,
    completionCount: 18,
    rating: 4.8,
    saved: false,
    followed: false,
    comments: ariComments,
    reason: {
      code: "SIMILAR_TASTE",
      matchedTopics: ["กาแฟ", "งานออกแบบ"],
      matchedAreas: ["Ari"],
    },
  },
  {
    id: "trace-old-town-light",
    itemType: "TRACE",
    slug: "old-town-light-walk",
    title: "แสงบ่ายในเมืองเก่า",
    description:
      "เดินผ่านตรอกเล็ก ร้านหนังสือ และมุมแสงที่เหมาะกับการถ่ายรูปโดยไม่เร่งรีบ",
    area: "Old Town",
    creator: oldTownTracer,
    coverTiles: ["OT", "LI", "WA"],
    coverImages: [
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=82",
      "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=900&q=82",
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=82",
    ],
    topicTags: ["ย่านเก่า", "ถ่ายรูป"],
    stopCount: 6,
    durationMinutes: 240,
    distanceKm: 4.1,
    budgetLabel: "฿฿",
    followerCount: 57,
    remixCount: 14,
    completionCount: 31,
    rating: 4.9,
    saved: true,
    followed: false,
    comments: oldTownComments,
    reason: { code: "POPULAR_NEARBY", matchedAreas: ["Old Town"] },
  },
  {
    id: "trace-sathorn-reset",
    itemType: "TRACE",
    slug: "sathorn-slow-reset",
    title: "พักใจใน Sathorn หลังเลิกงาน",
    description:
      "เส้นทางสั้นสำหรับวันที่อยากขยับตัว กินมื้อเย็นเบา ๆ และจบด้วยคลาสที่ไม่กดดัน",
    area: "Sathorn",
    creator: {
      ...ariTracer,
      id: "tracer-sathorn",
      name: "Ploy S.",
      initials: "PS",
      expertise: ["wellness", "dining"],
      area: "Sathorn",
      following: false,
    },
    coverTiles: ["SA", "RE", "ST"],
    coverImages: [
      "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=900&q=82",
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=82",
      "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=82",
    ],
    topicTags: ["wellness", "มื้อเย็น"],
    stopCount: 4,
    durationMinutes: 150,
    distanceKm: 2.1,
    budgetLabel: "฿฿฿",
    followerCount: 21,
    remixCount: 3,
    completionCount: 9,
    rating: null,
    saved: false,
    followed: true,
    comments: [],
    reason: { code: "FOLLOWING_TRACER" },
  },
];

export const demoPlaces: DiscoveryPlace[] = [
  {
    id: "place-north-star",
    itemType: "PLACE",
    slug: "north-star-coffee",
    name: "North Star Coffee",
    category: "Cafe",
    area: "Ari",
    priceLabel: "฿฿",
    openNow: true,
    imageUrl: null,
    venueSlug: "north-star-coffee",
    isAevoPlayPartner: true,
    description: "กาแฟ slow bar และมุมเงียบสำหรับเริ่มวัน",
    traceCount: 6,
    saved: false,
    comments: ariComments,
    reason: { code: "NEW_IN_SAVED_AREA", matchedAreas: ["Ari"] },
  },
  {
    id: "place-sora-table",
    itemType: "PLACE",
    slug: "sora-table",
    name: "Sora Table",
    category: "Dining",
    area: "Thonglor",
    priceLabel: "฿฿฿",
    openNow: null,
    imageUrl: null,
    venueSlug: "sora-table",
    isAevoPlayPartner: true,
    description: "จานตามฤดูกาลที่ใช้วัตถุดิบท้องถิ่นและไฟเปิด",
    traceCount: 4,
    saved: false,
    comments: [],
    reason: { code: "SIMILAR_TASTE", matchedTopics: ["มื้อเย็น"] },
  },
  {
    id: "place-calm-house",
    itemType: "PLACE",
    slug: "calm-house-studio",
    name: "Calm House Studio",
    category: "Wellness",
    area: "Sathorn",
    priceLabel: "฿฿",
    openNow: false,
    imageUrl: null,
    venueSlug: "calm-house-studio",
    isAevoPlayPartner: true,
    description: "สตูดิโอเล็กสำหรับ restorative movement และการฝึกที่มีสมาธิ",
    traceCount: 3,
    saved: true,
    comments: [],
    reason: { code: "POPULAR_NEARBY" },
  },
];

export const demoPosts: DiscoveryPost[] = [
  {
    id: "post-ari-window",
    itemType: "POST",
    author: ariTracer,
    body: "ถ้ามีเวลาช่วงเช้า ลองเริ่มจากกาแฟแล้วเดินดูงานออกแบบในซอยเดียวกันได้เลย ไม่ต้องวางแผนละเอียดมาก",
    publishedLabel: "2 ชั่วโมงที่แล้ว",
    mediaLabels: ["มุมหน้าร้าน", "โต๊ะริมหน้าต่าง"],
    mediaImages: [
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=82",
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=82",
    ],
    attachedObject: {
      itemType: "TRACE",
      id: demoTraces[0].id,
      title: demoTraces[0].title,
      subtitle: "5 stops · 3 ชั่วโมง · Ari",
      href: `/traces/${demoTraces[0].slug}`,
    },
    likeCount: 24,
    liked: false,
    comments: ariComments,
    reason: { code: "FOLLOWING_TRACER" },
  },
  {
    id: "post-old-town-note",
    itemType: "POST",
    author: oldTownTracer,
    body: "โน้ตสั้น ๆ: ถ้าจะเดิน Trace นี้ในวันหยุด ให้เริ่มก่อนสี่โมง แสงจะต่อเนื่องถึง stop สุดท้าย",
    publishedLabel: "เมื่อวาน",
    mediaLabels: ["แสงบ่ายในตรอก"],
    mediaImages: [
      "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=900&q=82",
    ],
    attachedObject: {
      itemType: "PLACE",
      id: demoPlaces[0].id,
      title: demoPlaces[0].name,
      subtitle: "Cafe · Ari · ฿฿",
      href: `/stores/${demoPlaces[0].slug}`,
    },
    likeCount: 41,
    liked: true,
    comments: oldTownComments,
    reason: { code: "POPULAR_NEARBY" },
  },
];

export const demoTracers: DiscoveryTracer[] = [
  {
    id: "tracer-recommendation-1",
    itemType: "TRACER",
    tracer: ariTracer,
    tasteMatchLabel: "ชอบกาแฟและงานออกแบบเหมือนคุณ",
    featuredTrace: {
      slug: demoTraces[0].slug,
      title: demoTraces[0].title,
      area: demoTraces[0].area,
      stopCount: demoTraces[0].stopCount,
    },
    followerCount: 184,
    reason: { code: "SIMILAR_TASTE", matchedTopics: ["กาแฟ", "งานออกแบบ"] },
  },
];

export const demoDiscoveryItems: DiscoveryItem[] = [
  demoTraces[0],
  demoPlaces[0],
  demoPosts[0],
  demoTraces[1],
  demoTracers[0],
  demoPlaces[1],
  demoPosts[1],
  demoTraces[2],
  demoPlaces[2],
];

export function filterDemoDiscoveryItems(
  items: readonly DiscoveryItem[],
  tab: "for_you" | "following" | "nearby",
  query: string,
  area: string,
  vibe = "",
): DiscoveryItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const normalizedVibe = vibe.trim().toLocaleLowerCase();
  const vibeTerms: Record<string, readonly string[]> = {
    "slow-bar": ["กาแฟ", "coffee", "cafe", "slow"],
    quiet: ["เงียบ", "quiet", "wellness", "พักใจ", "slow"],
    art: ["ศิลป", "งานออกแบบ", "ถ่ายรูป", "gallery", "art", "design"],
    work: ["กาแฟ", "work", "งานออกแบบ", "studio", "design"],
    speakeasy: ["bar", "บาร์", "มื้อเย็น", "dining"],
  };
  return items.filter((item) => {
    if (
      tab === "following" &&
      item.itemType !== "POST" &&
      item.itemType !== "TRACE" &&
      item.itemType !== "TRACER"
    )
      return false;
    if (
      tab === "following" &&
      item.itemType === "TRACE" &&
      !item.creator.following
    )
      return false;
    if (
      tab === "following" &&
      item.itemType === "TRACER" &&
      !item.tracer.following
    )
      return false;
    const itemArea =
      item.itemType === "TRACE" || item.itemType === "PLACE"
        ? item.area
        : item.itemType === "POST"
          ? item.author.area
          : item.tracer.area;
    if (tab === "nearby" && itemArea !== "Ari" && itemArea !== "ใกล้ฉัน")
      return false;
    if (area && itemArea !== area) return false;
    const searchable =
      item.itemType === "TRACE"
        ? `${item.title} ${item.description} ${item.area} ${item.topicTags.join(" ")}`
        : item.itemType === "PLACE"
          ? `${item.name} ${item.description} ${item.category} ${item.area}`
          : item.itemType === "POST"
          ? `${item.body} ${item.author.name} ${item.author.expertise.join(" ")}`
            : `${item.tracer.name} ${item.tracer.expertise.join(" ")} ${item.featuredTrace.title}`;
    const normalizedSearchable = searchable.toLocaleLowerCase();
    if (normalizedVibe && normalizedVibe !== "match") {
      const terms = vibeTerms[normalizedVibe];
      if (terms && !terms.some((term) => normalizedSearchable.includes(term)))
        return false;
    }
    if (!normalizedQuery) return true;
    return normalizedSearchable.includes(normalizedQuery);
  });
}
