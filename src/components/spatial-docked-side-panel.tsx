import type { ReactNode } from "react";
import { X } from "lucide-react";
import { GlidingGroup, type GlidingGroupItem } from "./gliding-group";

export interface SpatialDockedLayoutProps {
  isOpen: boolean;
  main: ReactNode;
  panel: ReactNode;
}

export function SpatialDockedLayout({
  isOpen,
  main,
  panel,
}: SpatialDockedLayoutProps) {
  return (
    <div className={`spatial-docked-layout${isOpen ? " is-open" : ""}`}>
      <div className="spatial-docked-layout__stage">{main}</div>
      <div className="spatial-docked-layout__panel">{panel}</div>
    </div>
  );
}

export interface SpatialDockedSidePanelProps {
  isOpen: boolean;
  activeTab: string;
  tabs: readonly GlidingGroupItem[];
  title: string;
  eyebrow?: string;
  onTabChange: (tab: string) => void;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function SpatialDockedSidePanel({
  isOpen,
  activeTab,
  tabs,
  title,
  eyebrow = "DETAIL DOCK",
  onTabChange,
  onClose,
  children,
  footer,
}: SpatialDockedSidePanelProps) {
  return (
    <aside
      className="spatial-docked-panel"
      aria-hidden={!isOpen}
      aria-label={title}
    >
      <header className="spatial-docked-panel__header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button icon-button--subtle"
          type="button"
          aria-label="ปิดแผงข้อมูล"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="spatial-docked-panel__tabs">
        <GlidingGroup
          items={tabs}
          activeId={activeTab}
          onChange={onTabChange}
          ariaLabel="โหมดของแผงข้อมูล"
          role="tablist"
          size="small"
        />
      </div>
      <div className="spatial-docked-panel__body">{children}</div>
      {footer && <footer className="spatial-docked-panel__footer">{footer}</footer>}
    </aside>
  );
}
