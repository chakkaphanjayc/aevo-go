import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbStep {
  label: string;
  to?: string;
  icon?: ReactNode;
}

export interface SubpageNavigationProps {
  breadcrumbs: BreadcrumbStep[];
  className?: string;
  ariaLabel?: string;
}

export function SubpageNavigation({
  breadcrumbs,
  className = "",
  ariaLabel = "ลำดับการนำทาง",
}: SubpageNavigationProps) {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return (
    <nav aria-label={ariaLabel} className={`subpage-navigation ${className}`.trim()}>
      <ol className="subpage-breadcrumbs">
        {breadcrumbs.map((step, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={`${step.label}-${index}`} className="subpage-breadcrumb-item">
              {index > 0 && (
                <ChevronRight
                  size={12}
                  className="subpage-breadcrumb-separator"
                  aria-hidden="true"
                />
              )}
              {step.to && !isLast ? (
                <Link to={step.to} className="subpage-breadcrumb-link">
                  {step.icon && <span className="subpage-breadcrumb-icon">{step.icon}</span>}
                  <span>{step.label}</span>
                </Link>
              ) : (
                <span
                  className={`subpage-breadcrumb-current${isLast ? " is-active" : ""}`}
                  aria-current={isLast ? "page" : undefined}
                >
                  {step.icon && <span className="subpage-breadcrumb-icon">{step.icon}</span>}
                  <span>{step.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
