import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ImagePlus,
  MapPinned,
  MapPin,
  Palette,
  Plus,
  Route,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { GlidingGroup, type GlidingGroupItem } from "@/components/gliding-group";
import { localRepository } from "@/lib/local-repository";
import type { DiscoveryRouteStop } from "./types";

export type DiscoveryComposerMode = "post" | "trace";
export type DiscoveryComposerVisibility = "public" | "followers";
export type DiscoveryComposerStyle = "obsidian" | "pearl" | "editorial";

export interface DiscoveryComposerMedia {
  id: string;
  name: string;
  src: string;
}

export interface DiscoveryPostDraft {
  mode: "post";
  body: string;
  media: readonly DiscoveryComposerMedia[];
  feeling: string | null;
  location: string;
  tags: readonly string[];
  visibility: DiscoveryComposerVisibility;
  style: DiscoveryComposerStyle;
  commentsEnabled: boolean;
}

export interface DiscoveryTraceDraft {
  mode: "trace";
  title: string;
  description: string;
  area: string;
  stops: readonly string[];
  routeStops: readonly DiscoveryRouteStop[];
  media: readonly DiscoveryComposerMedia[];
  feeling: string | null;
  tags: readonly string[];
  visibility: DiscoveryComposerVisibility;
  style: DiscoveryComposerStyle;
  allowRemix: boolean;
}

export type DiscoveryComposerDraft = DiscoveryPostDraft | DiscoveryTraceDraft;

export interface DiscoveryComposerProps {
  demoMode: boolean;
  onNotify: (message: string) => void;
  onPublish: (draft: DiscoveryComposerDraft) => void;
}

type ComposerTool = "media" | "feeling" | "location" | "tags" | "decorate" | "stops";

const moodOptions = [
  "Slow morning",
  "Hidden gem",
  "Food crawl",
  "Creative break",
  "After-work reset",
] as const;

const styleOptions: readonly {
  id: DiscoveryComposerStyle;
  label: string;
  description: string;
}[] = [
  { id: "obsidian", label: "Obsidian", description: "เข้ม คม และอ่านง่าย" },
  { id: "pearl", label: "Pearl", description: "ขอบขาวแบบ Light Struck" },
  { id: "editorial", label: "Editorial", description: "เรียบเหมือนบันทึกทริป" },
];

const tracePlaceOptions: readonly DiscoveryRouteStop[] = [
  {
    id: "north-star-coffee",
    name: "North Star Coffee",
    subtitle: "Slow bar · quiet corner",
    area: "Ari",
    category: "Cafe",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=560&q=82",
    point: { latitude: 13.7797, longitude: 100.5448 },
    isAevoPlayPartner: true,
  },
  {
    id: "ari-ceramic-house",
    name: "Ari Ceramic House",
    subtitle: "Hands-on workshop · 90 min",
    area: "Ari",
    category: "Activities",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=560&q=82",
    point: { latitude: 13.7818, longitude: 100.5478 },
    isAevoPlayPartner: true,
  },
  {
    id: "talat-noi-roastery",
    name: "Talat Noi Roastery",
    subtitle: "Local roast · old-town walk",
    area: "Charoenkrung",
    category: "Cafe",
    rating: 4.8,
    imageUrl: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=560&q=82",
    point: { latitude: 13.7318, longitude: 100.5134 },
    isAevoPlayPartner: true,
  },
  {
    id: "chao-phraya-table",
    name: "Chao Phraya Table",
    subtitle: "Thai tasting menu · riverside",
    area: "Charoenkrung",
    category: "Dining",
    rating: 4.6,
    imageUrl: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=560&q=82",
    point: { latitude: 13.7248, longitude: 100.5155 },
    isAevoPlayPartner: true,
  },
  {
    id: "sora-table",
    name: "Sora Table",
    subtitle: "Seasonal plates · open fire",
    area: "Thonglor",
    category: "Dining",
    rating: 4.7,
    imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=560&q=82",
    point: { latitude: 13.7354, longitude: 100.5793 },
    isAevoPlayPartner: true,
  },
  {
    id: "yaowarat-night-food",
    name: "Yaowarat Night Food",
    subtitle: "Street food crawl · walkable stops",
    area: "Yaowarat",
    category: "Dining",
    rating: 4.4,
    imageUrl: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=560&q=82",
    point: { latitude: 13.7395, longitude: 100.5101 },
  },
];

const tracePlaceMapPositions: Readonly<Record<string, { left: number; top: number }>> = {
  "north-star-coffee": { left: 26, top: 29 },
  "ari-ceramic-house": { left: 37, top: 23 },
  "talat-noi-roastery": { left: 62, top: 62 },
  "chao-phraya-table": { left: 72, top: 72 },
  "sora-table": { left: 78, top: 28 },
  "yaowarat-night-food": { left: 49, top: 56 },
};

const traceCategoryOptions = ["ทั้งหมด", "Cafe", "Dining", "Activities"] as const;

function estimateRouteDistanceKm(stops: readonly DiscoveryRouteStop[]): number {
  return stops.slice(1).reduce((total, stop, index) => {
    const previous = stops[index];
    if (!previous) return total;
    const latitudeDelta = (stop.point.latitude - previous.point.latitude) * 111.32;
    const longitudeDelta = (stop.point.longitude - previous.point.longitude) * 111.32 * Math.cos((stop.point.latitude * Math.PI) / 180);
    return total + Math.sqrt((latitudeDelta ** 2) + (longitudeDelta ** 2));
  }, 0);
}

function estimateStopMinutes(stop: DiscoveryRouteStop): number {
  if (stop.category === "Dining") return 60;
  if (stop.category === "Activities") return 90;
  return 45;
}

const acceptedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const maxImageBytes = 3 * 1024 * 1024;

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("image-read-failed"));
    };
    reader.onerror = () => reject(new Error("image-read-failed"));
    reader.readAsDataURL(file);
  });
}

function ToolButton({
  active,
  children,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`discover-composer__tool${active ? " is-active" : ""}`}
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`discover-composer__toggle${active ? " is-active" : ""}`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {active && <Check size={14} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

export function DiscoveryComposer({
  demoMode,
  onNotify,
  onPublish,
}: DiscoveryComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<DiscoveryComposerMode>("post");
  const [activeTool, setActiveTool] = useState<ComposerTool | null>(null);
  const [body, setBody] = useState("");
  const [traceTitle, setTraceTitle] = useState("");
  const [traceDescription, setTraceDescription] = useState("");
  const [area, setArea] = useState("Ari");
  const [location, setLocation] = useState("");
  const [feeling, setFeeling] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [routeSearch, setRouteSearch] = useState("");
  const [routeCategory, setRouteCategory] = useState<(typeof traceCategoryOptions)[number]>("ทั้งหมด");
  const [routeStops, setRouteStops] = useState<DiscoveryRouteStop[]>([]);
  const [media, setMedia] = useState<DiscoveryComposerMedia[]>([]);
  const [visibility, setVisibility] = useState<DiscoveryComposerVisibility>("public");
  const [style, setStyle] = useState<DiscoveryComposerStyle>("obsidian");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [allowRemix, setAllowRemix] = useState(true);
  const [pending, setPending] = useState<"draft" | "publish" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modeItems: readonly GlidingGroupItem[] = [
    {
      id: "post",
      label: (
        <span className="discover-composer__mode-label">
          <Sparkles size={15} aria-hidden="true" />
          Post
        </span>
      ),
    },
    {
      id: "trace",
      label: (
        <span className="discover-composer__mode-label">
          <Route size={15} aria-hidden="true" />
          Trace
        </span>
      ),
    },
  ];

  const openComposer = (nextMode: DiscoveryComposerMode) => {
    setMode(nextMode);
    setExpanded(true);
    setActiveTool(nextMode === "trace" ? "stops" : null);
    setNotice("");
    setError("");
  };

  const closeComposer = () => {
    if (pending) return;
    setExpanded(false);
    setActiveTool(null);
    setError("");
  };

  const resetComposer = () => {
    setBody("");
    setTraceTitle("");
    setTraceDescription("");
    setArea("Ari");
    setLocation("");
    setFeeling(null);
    setTags([]);
    setTagDraft("");
    setRouteSearch("");
    setRouteCategory("ทั้งหมด");
    setRouteStops([]);
    setMedia([]);
    setVisibility("public");
    setStyle("obsidian");
    setCommentsEnabled(true);
    setAllowRemix(true);
    setNotice("");
    setError("");
    setActiveTool(null);
  };

  const addTag = () => {
    const nextTag = tagDraft.trim().replace(/^#/, "").replace(/\s+/g, " ");
    if (!nextTag || tags.includes(nextTag) || tags.length >= 5) return;
    setTags((current) => [...current, nextTag]);
    setTagDraft("");
  };

  const toggleRouteStop = (place: DiscoveryRouteStop) => {
    const alreadySelected = routeStops.some((stop) => stop.id === place.id);
    if (alreadySelected) {
      setRouteStops((current) => current.filter((stop) => stop.id !== place.id));
      return;
    }
    if (routeStops.length >= 8) {
      setError("เลือกจุดแวะได้ไม่เกิน 8 จุดต่อหนึ่ง Trace");
      return;
    }
    setRouteStops((current) => [...current, place]);
    setError("");
    if (routeStops.length === 0 && area === "Ari") setArea(place.area);
  };

  const moveRouteStop = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= routeStops.length) return;
    setRouteStops((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (!moved) return current;
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const remaining = Math.max(0, 4 - media.length);
    if (remaining === 0) {
      setError("แนบรูปได้ไม่เกิน 4 รูปต่อหนึ่งรายการ");
      return;
    }
    const accepted = files.slice(0, remaining);
    const nextMedia: DiscoveryComposerMedia[] = [];
    for (const file of accepted) {
      if (!acceptedImageTypes.has(file.type)) {
        setError("รองรับเฉพาะ JPG, PNG, WebP หรือ GIF");
        continue;
      }
      if (file.size >= maxImageBytes) {
        setError("รูปแต่ละไฟล์ต้องมีขนาดต่ำกว่า 3 MB");
        continue;
      }
      try {
        nextMedia.push({
          id: `${file.name}-${file.lastModified}-${nextMedia.length}`,
          name: file.name,
          src: await readImageAsDataUrl(file),
        });
      } catch {
        setError("อ่านรูปไม่สำเร็จ ลองเลือกไฟล์ใหม่อีกครั้ง");
      }
    }
    if (nextMedia.length > 0) {
      setMedia((current) => [...current, ...nextMedia]);
      setError("");
    }
  };

  const normalizedRouteSearch = routeSearch.trim().toLocaleLowerCase();
  const visibleTracePlaces = tracePlaceOptions.filter((place) => {
    const matchesCategory = routeCategory === "ทั้งหมด" || place.category === routeCategory;
    if (!matchesCategory) return false;
    if (!normalizedRouteSearch) return true;
    return [place.name, place.subtitle, place.area, place.category]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedRouteSearch);
  });
  const routeLinePoints = routeStops
    .map((stop) => {
      const position = tracePlaceMapPositions[stop.id];
      return position ? `${position.left},${position.top}` : null;
    })
    .filter((point): point is string => point !== null)
    .join(" ");
  const estimatedRouteMinutes = routeStops.reduce((total, stop) => total + estimateStopMinutes(stop), 0);
  const estimatedRouteDistance = estimateRouteDistanceKm(routeStops);

  const buildDraft = (): DiscoveryComposerDraft => {
    if (mode === "trace") {
      return {
        mode,
        title: traceTitle.trim(),
        description: traceDescription.trim(),
        area: area.trim(),
        stops: routeStops.map((stop) => stop.name),
        routeStops,
        media,
        feeling,
        tags,
        visibility,
        style,
        allowRemix,
      };
    }
    return {
      mode,
      body: body.trim(),
      media,
      feeling,
      location: location.trim(),
      tags,
      visibility,
      style,
      commentsEnabled,
    };
  };

  const validateDraft = (draft: DiscoveryComposerDraft): string | null => {
    if (draft.mode === "post") {
      if (!draft.body && draft.media.length === 0) return "เพิ่มข้อความหรือรูปภาพก่อนเผยแพร่";
      return null;
    }
    if (!draft.title) return "ตั้งชื่อ Trace ก่อนเผยแพร่";
    if (draft.stops.length < 2) return "เพิ่มจุดแวะอย่างน้อย 2 จุดเพื่อสร้าง Trace";
    return null;
  };

  const saveDraft = async () => {
    const draft = buildDraft();
    setPending("draft");
    setNotice("");
    setError("");
    try {
      await localRepository.setPreference("discover-composer-draft-v1", draft);
      setNotice("บันทึก draft ไว้ในเครื่องแล้ว");
      onNotify("บันทึก draft ไว้ในเครื่องแล้ว");
    } catch {
      setError("บันทึก draft ไม่สำเร็จ ลองใหม่ได้");
    } finally {
      setPending(null);
    }
  };

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = buildDraft();
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!demoMode) {
      setNotice("การเผยแพร่จริงจะเปิดเมื่อ Customer Gateway มี content mutation contract");
      onNotify("ยังไม่ส่งข้อมูลจริง: Customer Gateway ยังไม่เปิด content mutation");
      return;
    }
    setPending("publish");
    setNotice("");
    setError("");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
    onPublish(draft);
    onNotify(draft.mode === "trace" ? "เผยแพร่ Trace ในฟีดแล้ว" : "เผยแพร่ Post ในฟีดแล้ว");
    resetComposer();
    setExpanded(false);
    setPending(null);
  };

  const toggleTool = (tool: ComposerTool) => {
    setNotice("");
    setError("");
    setActiveTool((current) => (current === tool ? null : tool));
  };

  return (
    <section className="discover-composer" aria-labelledby="discover-composer-title">
      <div className="discover-composer__topline">
        <div className="discover-composer__identity">
          <span className="discovery-avatar" aria-hidden="true">AG</span>
          <div>
            <p className="eyebrow">SHARE YOUR CITY</p>
            <h3 id="discover-composer-title">แบ่งปันสิ่งที่คุณอยากให้คนอื่นลอง</h3>
          </div>
        </div>
        {expanded && (
          <button
            className="icon-button icon-button--subtle"
            type="button"
            aria-label="ปิดตัวสร้างคอนเทนต์"
            onClick={closeComposer}
            disabled={pending !== null}
          >
            <X size={17} aria-hidden="true" />
          </button>
        )}
      </div>

      {!expanded ? (
        <>
          <button
            className="discover-composer__prompt"
            type="button"
            onClick={() => openComposer("post")}
          >
            <span>วันนี้คุณค้นพบอะไรมา?</span>
            <Send size={16} aria-hidden="true" />
          </button>
          <div className="discover-composer__quick-actions" role="toolbar" aria-label="เริ่มสร้างคอนเทนต์">
            <button type="button" onClick={() => { openComposer("post"); setActiveTool("media"); }}>
              <ImagePlus size={17} aria-hidden="true" />
              <span>เพิ่มรูป</span>
            </button>
            <button type="button" onClick={() => openComposer("trace")}>
              <Route size={17} aria-hidden="true" />
              <span>สร้าง Trace</span>
            </button>
            <button type="button" onClick={() => { openComposer("post"); setActiveTool("feeling"); }}>
              <Sparkles size={17} aria-hidden="true" />
              <span>เพิ่มความรู้สึก</span>
            </button>
          </div>
        </>
      ) : (
        <form className="discover-composer__editor" onSubmit={publish}>
          <GlidingGroup
            items={modeItems}
            activeId={mode}
            ariaLabel="เลือกประเภทคอนเทนต์"
            role="tablist"
            size="small"
            className="discover-composer__modes"
            onChange={(id) => {
              if (id === "post" || id === "trace") {
                setMode(id);
                setActiveTool(id === "trace" ? "stops" : null);
                setError("");
              }
            }}
          />

          {mode === "post" ? (
            <label className="discover-composer__field">
              <span className="sr-only">ข้อความ Post</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="เล่าเรื่องร้าน มุมโปรด หรือจังหวะดี ๆ ของวันนี้…"
                maxLength={2000}
                autoFocus
              />
            </label>
          ) : (
            <div className="discover-composer__trace-fields">
              <label className="discover-composer__field">
                <span>ชื่อ Trace</span>
                <input
                  value={traceTitle}
                  onChange={(event) => setTraceTitle(event.target.value)}
                  placeholder="เช่น เช้าเบา ๆ ที่อารีย์"
                  maxLength={120}
                  autoFocus
                />
              </label>
              <div className="discover-composer__field-row">
                <label className="discover-composer__field">
                  <span>ย่านหลัก</span>
                  <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Ari" maxLength={80} />
                </label>
                <label className="discover-composer__field">
                  <span>ความรู้สึกของเส้นทาง</span>
                  <input value={traceDescription} onChange={(event) => setTraceDescription(event.target.value)} placeholder="เดินช้า ๆ แล้วเจออะไรดี ๆ" maxLength={240} />
                </label>
              </div>
            </div>
          )}

          <div className="discover-composer__tool-row" role="toolbar" aria-label="ตกแต่งคอนเทนต์">
            <ToolButton active={activeTool === "media"} icon={<ImagePlus size={16} aria-hidden="true" />} label="เพิ่มรูปภาพ" onClick={() => toggleTool("media")}>รูปภาพ</ToolButton>
            <ToolButton active={activeTool === "feeling"} icon={<Sparkles size={16} aria-hidden="true" />} label="เพิ่ม mood" onClick={() => toggleTool("feeling")}>Mood</ToolButton>
            <ToolButton active={activeTool === "location"} icon={<MapPin size={16} aria-hidden="true" />} label="เพิ่มสถานที่" onClick={() => toggleTool("location")}>สถานที่</ToolButton>
            <ToolButton active={activeTool === "tags"} icon={<Tag size={16} aria-hidden="true" />} label="เพิ่มหัวข้อ" onClick={() => toggleTool("tags")}>หัวข้อ</ToolButton>
            <ToolButton active={activeTool === "decorate"} icon={<Palette size={16} aria-hidden="true" />} label="ตกแต่งคอนเทนต์" onClick={() => toggleTool("decorate")}>ตกแต่ง</ToolButton>
            {mode === "trace" && <ToolButton active={activeTool === "stops"} icon={<Route size={16} aria-hidden="true" />} label="จัดการจุดแวะ" onClick={() => toggleTool("stops")}>จุดแวะ</ToolButton>}
          </div>

          {activeTool === "media" && (
            <div className="discover-composer__tool-panel">
              <div className="discover-composer__panel-heading">
                <div><strong>เพิ่มรูปให้เรื่องนี้</strong><small>JPG, PNG, WebP หรือ GIF · ไฟล์ละไม่เกิน 3 MB · สูงสุด 4 รูป</small></div>
                <button className="button button--ghost button--compact" type="button" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus size={15} aria-hidden="true" />เลือกรูป
                </button>
              </div>
              <input ref={fileInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => void handleFiles(event)} />
              {media.length > 0 ? (
                <div className="discover-composer__media-preview" aria-label="รูปที่เลือก">
                  {media.map((image) => (
                    <figure key={image.id}>
                      <img src={image.src} alt={image.name} />
                      <button type="button" aria-label={`ลบ ${image.name}`} onClick={() => setMedia((current) => current.filter((item) => item.id !== image.id))}>
                        <X size={13} aria-hidden="true" />
                      </button>
                    </figure>
                  ))}
                </div>
              ) : (
                <button className="discover-composer__upload-empty" type="button" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus size={18} aria-hidden="true" />
                  <span>เลือกภาพบรรยากาศของคุณ</span>
                </button>
              )}
            </div>
          )}

          {activeTool === "feeling" && (
            <div className="discover-composer__tool-panel">
              <div className="discover-composer__panel-heading"><strong>เลือก mood ของเรื่องนี้</strong><small>ช่วยให้คนที่มีรสนิยมใกล้กันค้นพบคุณ</small></div>
              <div className="discover-composer__choice-row">
                {moodOptions.map((option) => <ToggleButton key={option} active={feeling === option} onClick={() => setFeeling(feeling === option ? null : option)}>{option}</ToggleButton>)}
              </div>
            </div>
          )}

          {activeTool === "location" && (
            <div className="discover-composer__tool-panel">
              <label className="discover-composer__field">
                <span>สถานที่หรือย่านที่เกี่ยวข้อง</span>
                <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="เช่น Ari, Talat Noi หรือ North Star Coffee" maxLength={100} />
              </label>
            </div>
          )}

          {activeTool === "tags" && (
            <div className="discover-composer__tool-panel">
              <label className="discover-composer__field">
                <span>หัวข้อที่ช่วยจัดหมวดหมู่</span>
                <div className="discover-composer__inline-input">
                  <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(); } }} placeholder="เช่น specialty coffee" maxLength={40} />
                  <button className="icon-button icon-button--subtle" type="button" aria-label="เพิ่มหัวข้อ" onClick={addTag}><Plus size={16} aria-hidden="true" /></button>
                </div>
              </label>
              {tags.length > 0 && <div className="discover-composer__tag-list">{tags.map((tag) => <button key={tag} className="discover-composer__tag" type="button" onClick={() => setTags((current) => current.filter((item) => item !== tag))}>#{tag}<X size={12} aria-hidden="true" /></button>)}</div>}
            </div>
          )}

          {activeTool === "decorate" && (
            <div className="discover-composer__tool-panel">
              <div className="discover-composer__panel-heading"><strong>จัด mood & สิทธิ์การมีส่วนร่วม</strong><small>ตกแต่งเพื่อเล่าเรื่อง โดยยังคงคอนทราสต์อ่านง่าย</small></div>
              <div className="discover-composer__style-grid">
                {styleOptions.map((option) => <button key={option.id} className={`discover-composer__style-option discover-composer__style-option--${option.id}${style === option.id ? " is-active" : ""}`} type="button" aria-pressed={style === option.id} onClick={() => setStyle(option.id)}><span><strong>{option.label}</strong><small>{option.description}</small></span>{style === option.id && <Check size={15} aria-hidden="true" />}</button>)}
              </div>
              <div className="discover-composer__toggle-row">
                <ToggleButton active={visibility === "public"} onClick={() => setVisibility("public")}><Users size={14} aria-hidden="true" />ทุกคนเห็นได้</ToggleButton>
                <ToggleButton active={visibility === "followers"} onClick={() => setVisibility("followers")}><Users size={14} aria-hidden="true" />เฉพาะคนติดตาม</ToggleButton>
                {mode === "post" ? <ToggleButton active={commentsEnabled} onClick={() => setCommentsEnabled((current) => !current)}>เปิดความคิดเห็น</ToggleButton> : <ToggleButton active={allowRemix} onClick={() => setAllowRemix((current) => !current)}>อนุญาต Remix</ToggleButton>}
              </div>
            </div>
          )}

          {mode === "trace" && activeTool === "stops" && (
            <div className="discover-composer__tool-panel discover-route-builder" aria-label="ตัวสร้างเส้นทาง Trace">
              <div className="discover-route-builder__heading">
                <div>
                  <p className="eyebrow">TRACE BUILDER</p>
                  <strong>เลือกสถานที่ แล้วเรียงเป็นเส้นทาง</strong>
                  <small>เลือกจากรายการหรือแตะหมุดบนแผนที่พรีวิวเพื่อเพิ่มจุดแวะ</small>
                </div>
                <span className="discover-route-builder__count">{routeStops.length}/8 จุด</span>
              </div>

              <div className="discover-route-builder__layout">
                <div className="discover-route-builder__catalog">
                  <label className="discover-route-builder__search">
                    <Search size={16} aria-hidden="true" />
                    <span className="sr-only">ค้นหาสถานที่ใน Trace</span>
                    <input
                      value={routeSearch}
                      onChange={(event) => setRouteSearch(event.target.value)}
                      placeholder="ค้นหาร้าน ย่าน หรือกิจกรรม"
                      aria-label="ค้นหาสถานที่ใน Trace"
                    />
                  </label>
                  <div className="discover-route-builder__filters" role="toolbar" aria-label="กรองสถานที่ใน Trace">
                    {traceCategoryOptions.map((category) => (
                      <button
                        key={category}
                        className={routeCategory === category ? "is-active" : ""}
                        type="button"
                        aria-pressed={routeCategory === category}
                        onClick={() => setRouteCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                  <div className="discover-route-builder__place-list" aria-label="รายการสถานที่ให้เลือก">
                    {visibleTracePlaces.length > 0 ? visibleTracePlaces.map((place) => {
                      const selectedIndex = routeStops.findIndex((stop) => stop.id === place.id);
                      const selected = selectedIndex >= 0;
                      return (
                        <button
                          key={place.id}
                          className={`discover-route-builder__place${selected ? " is-selected" : ""}`}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${selected ? "นำออกจาก" : "เพิ่ม"} ${place.name} ใน Trace`}
                          onClick={() => toggleRouteStop(place)}
                        >
                          <span className="discover-route-builder__place-image">
                            {place.imageUrl ? <img src={place.imageUrl} alt="" /> : <MapPin size={17} aria-hidden="true" />}
                          </span>
                          <span className="discover-route-builder__place-copy">
                            <strong>{place.name}</strong>
                            <small>{place.area} · {place.category} · {place.subtitle}</small>
                            <span className="discover-route-builder__place-meta">
                              {place.rating !== null && <span>★ {place.rating.toFixed(1)}</span>}
                              {place.isAevoPlayPartner && <span className="discover-route-builder__bookable">Aevo Play</span>}
                            </span>
                          </span>
                          <span className="discover-route-builder__place-action">
                            {selected ? <><CheckCircle2 size={17} aria-hidden="true" /><span>จุดที่ {selectedIndex + 1}</span></> : <><Plus size={17} aria-hidden="true" /><span>เพิ่ม</span></>}
                          </span>
                        </button>
                      );
                    }) : (
                      <p className="discover-composer__empty-panel">ไม่พบสถานที่ที่ตรงกับการค้นหา ลองเปลี่ยนคำหรือหมวดหมู่</p>
                    )}
                  </div>
                </div>

                <div className="discover-route-builder__map-panel">
                  <div className="discover-route-builder__map-heading">
                    <div><MapPinned size={15} aria-hidden="true" /><strong>เส้นทางพรีวิว</strong></div>
                    <small>{routeStops.length > 1 ? `${routeStops.length} จุด · ประมาณ ${Math.round(estimatedRouteMinutes / 60 * 10) / 10} ชม. · ${estimatedRouteDistance.toFixed(1)} กม.` : "แตะหมุดเพื่อเริ่มเลือก"}</small>
                  </div>
                  <div className="discover-route-builder__map-canvas" role="region" aria-label="แผนที่พรีวิวจุดแวะของ Trace">
                    <div className="discover-route-builder__map-road discover-route-builder__map-road--one" aria-hidden="true" />
                    <div className="discover-route-builder__map-road discover-route-builder__map-road--two" aria-hidden="true" />
                    <svg className="discover-route-builder__route-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      {routeLinePoints && <polyline points={routeLinePoints} fill="none" vectorEffect="non-scaling-stroke" />}
                    </svg>
                    {tracePlaceOptions.map((place) => {
                      const position = tracePlaceMapPositions[place.id];
                      if (!position) return null;
                      const selectedIndex = routeStops.findIndex((stop) => stop.id === place.id);
                      const selected = selectedIndex >= 0;
                      return (
                        <button
                          key={place.id}
                          className={`discover-route-builder__map-pin${selected ? " is-selected" : ""}`}
                          style={{ left: `${position.left}%`, top: `${position.top}%` }}
                          type="button"
                          aria-label={`แผนที่: ${selected ? "นำออกจาก" : "เพิ่ม"} ${place.name} ใน Trace`}
                          aria-pressed={selected}
                          onClick={() => toggleRouteStop(place)}
                        >
                          {selected ? selectedIndex + 1 : <MapPin size={14} aria-hidden="true" />}
                        </button>
                      );
                    })}
                    <span className="discover-route-builder__map-label discover-route-builder__map-label--top">Ari</span>
                    <span className="discover-route-builder__map-label discover-route-builder__map-label--bottom">Bangkok route preview</span>
                  </div>
                </div>
              </div>

              <div className="discover-route-builder__selected">
                <div className="discover-route-builder__selected-heading">
                  <div><strong>ลำดับการเดินทาง</strong><small>{routeStops.length > 0 ? `ประมาณ ${Math.round(estimatedRouteMinutes / 60 * 10) / 10} ชม. · ${estimatedRouteDistance.toFixed(1)} กม. · ใช้ปุ่มลูกศรเพื่อจัดจังหวะ` : "ใช้ปุ่มลูกศรเพื่อจัดจังหวะการเดินทาง"}</small></div>
                  {routeStops.length > 0 && <button className="text-link text-link--button" type="button" onClick={() => setRouteStops([])}>ล้างทั้งหมด</button>}
                </div>
                {routeStops.length > 0 ? (
                  <ol className="discover-route-builder__selected-list">
                    {routeStops.map((stop, index) => (
                      <li key={stop.id}>
                        <span className="discover-route-builder__selected-number">{String(index + 1).padStart(2, "0")}</span>
                        <span className="discover-route-builder__selected-copy"><strong>{stop.name}</strong><small>{stop.area} · {stop.category}</small></span>
                        <span className="discover-route-builder__selected-actions">
                          <button className="icon-button icon-button--subtle" type="button" aria-label={`เลื่อน ${stop.name} ขึ้น`} onClick={() => moveRouteStop(index, -1)} disabled={index === 0}><ArrowUp size={14} aria-hidden="true" /></button>
                          <button className="icon-button icon-button--subtle" type="button" aria-label={`เลื่อน ${stop.name} ลง`} onClick={() => moveRouteStop(index, 1)} disabled={index === routeStops.length - 1}><ArrowDown size={14} aria-hidden="true" /></button>
                          <button className="icon-button icon-button--subtle" type="button" aria-label={`ลบจุดแวะ ${stop.name}`} onClick={() => toggleRouteStop(stop)}><Trash2 size={14} aria-hidden="true" /></button>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="discover-composer__empty-panel">ยังไม่มีจุดแวะ · เลือกอย่างน้อย 2 สถานที่เพื่อเผยแพร่ Trace</p>
                )}
              </div>
            </div>
          )}

          {(body || traceTitle || traceDescription || media.length > 0 || routeStops.length > 0 || tags.length > 0) && (
            <div className={`discover-composer__preview discover-composer__preview--${style}`}>
              <span className="eyebrow">LIVE PREVIEW</span>
              {mode === "post" ? <p>{body || "ข้อความของคุณจะแสดงตรงนี้"}</p> : <><strong>{traceTitle || "ชื่อ Trace ของคุณ"}</strong><p>{traceDescription || "คำอธิบายเส้นทางและจังหวะที่อยากเล่า"}</p><small>{routeStops.length > 0 ? `${routeStops.length} จุดแวะ · ${area}` : "ยังไม่ได้เพิ่มจุดแวะ"}</small></>}
              {feeling && <span className="discover-composer__preview-meta"><Sparkles size={13} aria-hidden="true" />{feeling}</span>}
              {location && <span className="discover-composer__preview-meta"><MapPin size={13} aria-hidden="true" />{location}</span>}
              {tags.length > 0 && <span className="discover-composer__preview-meta"><Tag size={13} aria-hidden="true" />{tags.map((tag) => `#${tag}`).join(" ")}</span>}
            </div>
          )}

          <div className="discover-composer__footer">
            <div className="discover-composer__footer-meta">
              <label className="discover-composer__visibility">
                <span className="sr-only">สิทธิ์การมองเห็น</span>
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as DiscoveryComposerVisibility)} aria-label="สิทธิ์การมองเห็น">
                  <option value="public">ทุกคนเห็นได้</option>
                  <option value="followers">เฉพาะคนติดตาม</option>
                </select>
              </label>
              {notice && <span className="discover-composer__status" role="status">{notice}</span>}
              {error && <span className="discover-composer__error" role="alert">{error}</span>}
            </div>
            <div className="discover-composer__footer-actions">
              <button className="button button--ghost button--compact" type="button" onClick={() => { resetComposer(); setExpanded(false); }} disabled={pending !== null}>ยกเลิก</button>
              <button className="button button--ghost button--compact" type="button" onClick={() => void saveDraft()} disabled={pending !== null} aria-busy={pending === "draft" || undefined}>{pending === "draft" ? "กำลังบันทึก…" : "บันทึก draft"}</button>
              <button className="button button--dark button--compact" type="submit" disabled={pending !== null} aria-busy={pending === "publish" || undefined}>{pending === "publish" ? "กำลังเผยแพร่…" : <><Send size={15} aria-hidden="true" />เผยแพร่</>}</button>
            </div>
          </div>
          {!demoMode && <p className="discover-composer__gateway-note" role="note">โหมด live: ตัวแก้ไขพร้อมใช้งาน แต่จะไม่ส่งข้อมูลจริงจนกว่า content mutation contract จะเปิดใช้</p>}
        </form>
      )}
    </section>
  );
}
