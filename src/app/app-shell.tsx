import { useEffect } from "react";
import {
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigation,
} from "react-router-dom";
import {
  CalendarDays,
  Compass,
  Heart,
  Map,
  UserRound,
} from "lucide-react";
import { SpotlightSearch } from "@/components/spotlight-search";
import { useUiStore } from "@/lib/ui-store";

const navigationItems = [
  { to: "/", label: "Explore", icon: Compass, end: true },
  { to: "/map", label: "Trace Map", icon: Map, end: false },
  { to: "/saved", label: "Saved", icon: Heart, end: false },
  { to: "/activity", label: "Activity", icon: CalendarDays, end: false },
] as const;

const mobileNavigationItems = [
  { to: "/", label: "Explore", icon: Compass, end: true },
  { to: "/map", label: "Map", icon: Map, end: false },
  { to: "/saved", label: "Saved", icon: Heart, end: false },
  { to: "/activity", label: "Activity", icon: CalendarDays, end: false },
  { to: "/profile", label: "Profile", icon: UserRound, end: false },
] as const;

export function AppShell() {
  const location = useLocation();
  const navigation = useNavigation();
  const theme = useUiStore((state) => state.theme);
  const focusFlow = location.pathname === "/checkout";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className={`app-shell${focusFlow ? " app-shell--focus-flow" : ""}`}>
      <a className="skip-link" href="#main-content">
        ข้ามไปยังเนื้อหา
      </a>
      <header className="topbar">
        <div className="topbar__inner">
          <div className="topbar__leading">
            <NavLink className="brand" to="/" aria-label="Aevocado Go home">
              <span className="brand-mark" aria-hidden="true">
                AG
              </span>
              <span>
                <strong>Aevocado</strong>
                <small>GO</small>
              </span>
            </NavLink>
            <nav className="desktop-nav" aria-label="Primary navigation">
              {navigationItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  className={({ isActive }) =>
                    `desktop-nav__item${isActive ? " desktop-nav__item--active" : ""}`
                  }
                  to={to}
                  end={end ?? false}
                >
                  <Icon size={16} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="topbar__actions">
            <SpotlightSearch />
            <NavLink
              className="avatar-trigger topbar__profile"
              to="/profile"
              aria-label="เปิด Profile"
            >
              <span aria-hidden="true">AG</span>
            </NavLink>
          </div>
        </div>
      </header>

      {navigation.state !== "idle" && (
        <div className="route-progress" role="status" aria-live="polite">
          กำลังเปิดหน้า…
        </div>
      )}
      <main id="main-content" className="page-content">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {mobileNavigationItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            className={({ isActive }) =>
              `nav-item${isActive ? " nav-item--active" : ""}`
            }
            to={to}
            end={end ?? false}
          >
            <Icon size={19} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <ScrollRestoration
        getKey={(location) =>
          location.pathname === "/" ? "explore" : location.key
        }
      />
    </div>
  );
}
