import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Home, Utensils, Dumbbell, Pill, LineChart } from "lucide-react";
import clsx from "clsx";

export interface NavTab {
  name: string;
  path: string;
  icon: LucideIcon;
}

/** Five primary tabs. The last doubles as the "Mehr" (more) entry. */
export const TABS: NavTab[] = [
  { name: "Dashboard", path: "/", icon: Home },
  { name: "Essen", path: "/food", icon: Utensils },
  { name: "Training", path: "/training", icon: Dumbbell },
  { name: "Supps", path: "/supplements", icon: Pill },
  { name: "Gewicht", path: "/weight", icon: LineChart },
];

/**
 * Fixed, accessible bottom navigation with safe-area padding.
 * Each tab is a real link with an aria-current state.
 */
export function BottomNav({ tabs = TABS }: { tabs?: NavTab[] }) {
  const location = useLocation();

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border pb-safe"
    >
      <div className="mx-auto flex justify-around items-stretch h-16 max-w-md">
        {tabs.map((tab) => {
          const isActive =
            tab.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={isActive ? "page" : undefined}
              className={clsx(
                "flex flex-col items-center justify-center flex-1 min-h-[44px] gap-1",
                "transition-colors duration-150 ease-standard",
                isActive ? "text-accent" : "text-muted hover:text-text",
              )}
            >
              <Icon
                size={24}
                aria-hidden="true"
                className={clsx(
                  "transition-transform duration-150",
                  isActive && "scale-110",
                )}
              />
              <span className="text-[10px] font-medium leading-none">
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;