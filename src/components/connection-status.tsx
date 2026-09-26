import { useQuery } from "@tanstack/react-query";
import { Check, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { checkGatewayConnection, type GatewayConnection } from "@/lib/connection";

function statusCopy(status: GatewayConnection["status"]): { label: string; title: string } {
  if (status === "connected") return { label: "READY", title: "พร้อมเริ่ม customer journey" };
  if (status === "degraded") return { label: "DEGRADED", title: "Gateway พร้อม แต่ระบบบางส่วนยังไม่พร้อม" };
  return { label: "OFFLINE", title: "กำลังรอ Customer Gateway" };
}

export function ConnectionStatusCard({ compact = false }: { compact?: boolean }) {
  const query = useQuery({
    queryKey: ["gateway", "connection"],
    queryFn: checkGatewayConnection,
    retry: false,
    refetchInterval: 30_000
  });

  if (query.isPending) {
    return (
      <section className={`connection-card connection-card--loading${compact ? " connection-card--compact" : ""}`} aria-busy="true" aria-live="polite">
        <span className="status-dot status-dot--loading" aria-hidden="true"><LoaderCircle size={14} /></span>
        <div><p className="eyebrow">SYSTEM CHECK</p><p className="connection-title">กำลังตรวจสอบ Customer Gateway…</p></div>
      </section>
    );
  }

  const connection = query.data;
  const status = connection?.status ?? "unavailable";
  const copy = statusCopy(status);
  const error = connection?.ready.error ?? connection?.health.error;

  return (
    <section className={`connection-card connection-card--${status}${compact ? " connection-card--compact" : ""}`} aria-labelledby="connection-card-title">
      <div className="connection-card__main">
        <span className={`status-dot status-dot--${status}`} aria-hidden="true">
          {status === "connected" ? <Check size={13} /> : <CircleAlert size={14} />}
        </span>
        <div>
          <div className="connection-card__label"><span className="eyebrow">CUSTOMER GATEWAY</span><span className="status-pill">{copy.label}</span></div>
          <p className="connection-title" id="connection-card-title">{copy.title}</p>
          {!compact && <p className="connection-copy">{connection?.health.service ?? "Aevocado Core API"} · health {connection?.health.httpStatus ?? "—"} · ready {connection?.ready.httpStatus ?? "—"}</p>}
          {error && <p className="connection-error" role="alert">{error}</p>}
        </div>
      </div>
      <button className="icon-button icon-button--subtle" type="button" onClick={() => void query.refetch()} disabled={query.isFetching} aria-label="ตรวจสอบ Customer Gateway อีกครั้ง" title="ตรวจสอบอีกครั้ง">
        <RefreshCw size={16} className={query.isFetching ? "spin" : undefined} aria-hidden="true" />
      </button>
    </section>
  );
}
