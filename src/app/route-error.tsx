import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const title = isRouteErrorResponse(error) && error.status === 404
    ? "ไม่พบหน้าที่ต้องการ"
    : "หน้านี้โหลดไม่สำเร็จ";

  return (
    <main className="standalone-page">
      <section className="error-card" role="alert" aria-labelledby="route-error-title">
        <span className="icon-badge icon-badge--danger" aria-hidden="true"><AlertTriangle size={20} /></span>
        <p className="eyebrow">AEVOCADO GO / RECOVERY</p>
        <h1 id="route-error-title">{title}</h1>
        <p className="body-copy">ลองกลับไปที่ Explore หรือโหลดเส้นทางนี้ใหม่อีกครั้ง</p>
        <div className="button-row">
          <button className="button button--primary" type="button" onClick={() => window.location.reload()}>
            <RotateCcw size={16} aria-hidden="true" />
            โหลดใหม่
          </button>
          <Link className="button button--ghost" to="/">
            <ArrowLeft size={16} aria-hidden="true" />
            กลับ Explore
          </Link>
        </div>
      </section>
    </main>
  );
}
