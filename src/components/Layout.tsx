import type { ReactNode } from "react";
import { UserButton } from "@clerk/clerk-react";
import BottomNav from "./BottomNav";

interface LayoutProps {
  /** Optional header title; defaults to the product name. */
  title?: ReactNode;
  /** Optional node rendered on the right of the header (defaults to Clerk UserButton). */
  headerRight?: ReactNode;
  children: ReactNode;
}

/**
 * App shell: sticky header + scrollable main + fixed bottom nav.
 * Optimized for 375px viewports and up. Main has bottom padding so
 * content never hides behind the fixed BottomNav.
 */
export function Layout({ title = "IronLog", headerRight, children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg text-text max-w-md mx-auto relative">
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border pt-safe">
        <div className="h-14 flex items-center justify-between px-4">
          <h1 className="text-lg font-bold text-text-strong tracking-tight">
            {title}
          </h1>
          {headerRight ?? <UserButton afterSignOutUrl="/" />}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      <BottomNav />
    </div>
  );
}

export default Layout;