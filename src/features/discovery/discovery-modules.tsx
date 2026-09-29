import { Compass, MapPin, Sparkles } from "lucide-react";
import { DiscoveryCard, type DiscoveryActionHandlers } from "./discovery-cards";
import type { DiscoveryModuleView } from "./feed-adapter";

const moduleTitles: Record<DiscoveryModuleView["moduleId"], string> = {
  FOR_YOU: "คัดสรรให้คุณ",
  NEAR_SELECTED_AREA: "ใกล้พื้นที่ที่เลือก",
  NEW_AND_USEFUL: "ใหม่และมีประโยชน์",
  COMMUNITY_FAVORITES: "ชุมชนแนะนำ",
};

const moduleReasonCopy: Record<NonNullable<DiscoveryModuleView["reasonCode"]>, string> = {
  BECAUSE_VIBE: "อิงจากบรรยากาศที่คุณเลือก",
  BECAUSE_CATEGORY: "อิงจากหมวดที่คุณกำลังค้นหา",
  NEAR_SELECTED_AREA: "อิงจากพื้นที่ที่คุณเลือก",
  NEAR_CURRENT_COARSE_AREA: "อิงจากพื้นที่ใกล้เคียงแบบคร่าว ๆ",
  SIMILAR_TO_SAVED: "คล้ายกับสิ่งที่คุณบันทึกไว้",
  NEW_IN_AREA: "รายการใหม่ในพื้นที่นี้",
  POPULAR_IN_AREA: "กำลังเป็นที่นิยมในพื้นที่นี้",
  AVAILABLE_NOW: "มีสัญญาณความพร้อมใช้งาน",
  BASED_ON_COMPLETED_TRACE: "ต่อยอดจาก Trace ที่คุณทำสำเร็จ",
  BECAUSE_YOU_VISITED: "ต่อยอดจากสถานที่ที่คุณเคยไป",
  CONTINUE_YOUR_TRACE: "ต่อจากเส้นทางที่คุณเริ่มไว้",
  COMMUNITY_CONFIDENCE: "มีหลักฐานจากชุมชนประกอบ",
};

function moduleReason(module: DiscoveryModuleView): string {
  return module.reasonCode
    ? moduleReasonCopy[module.reasonCode]
    : "รายการสถานที่และประสบการณ์ที่คัดมาเพื่อการค้นพบ";
}

export function DiscoveryModuleShelf({
  modules,
  handlers,
}: {
  modules: readonly DiscoveryModuleView[];
  handlers: DiscoveryActionHandlers;
}) {
  if (modules.length === 0) return null;

  return (
    <div className="discovery-module-stack" aria-label="Discovery modules">
      {modules.map((module) => (
        <section
          key={module.moduleId}
          className="discovery-module"
          aria-labelledby={`discovery-module-${module.moduleId}`}
        >
          <header className="discovery-module__heading">
            <div>
              <p className="eyebrow">
                <Sparkles size={12} aria-hidden="true" /> DISCOVERY MODULE
              </p>
              <h3 id={`discovery-module-${module.moduleId}`}>
                {moduleTitles[module.moduleId]}
              </h3>
              <p>{moduleReason(module)}</p>
            </div>
            <span className="discovery-module__count">
              {module.items.length} รายการ
            </span>
          </header>
          {module.degraded && (
            <div className="discovery-module__notice" role="status">
              <Compass size={14} aria-hidden="true" />
              กำลังแสดงคำแนะนำจากแหล่งข้อมูลที่พร้อมใช้งาน
            </div>
          )}
          <div className="discovery-module__items">
            {module.items.map((item) => (
              <DiscoveryCard
                key={`${item.itemType}-${item.id}`}
                item={item}
                handlers={handlers}
              />
            ))}
          </div>
          <p className="discovery-module__privacy-note">
            <MapPin size={12} aria-hidden="true" /> เหตุผลเป็นคำอธิบายระดับหมวดหมู่ ไม่เปิดเผยคะแนนหรือพิกัดละเอียด
          </p>
        </section>
      ))}
    </div>
  );
}
