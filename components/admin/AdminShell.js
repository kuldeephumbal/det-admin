'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import Sidebar from './Sidebar';

const Ctx = createContext({ openSidebar: () => {}, closeSidebar: () => {}, sidebarOpen: false });

export function useAdminLayout() {
  return useContext(Ctx);
}

/**
 * The actual chrome for every authenticated /admin/* page.
 *
 *   <body>
 *   └── div.h-screen.flex.overflow-hidden    ← no body scroll, ever
 *       ├── Sidebar  (fixed drawer < lg; static aside ≥ lg)
 *       └── div.flex-1.overflow-y-auto        ← independent scroll column
 *           └── {children}                    (Topbar sticky inside, then <main>)
 */
export default function AdminShell({ admin, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const path = usePathname();

  // Auto-close the drawer when navigation changes (route change).
  useEffect(() => {
    setSidebarOpen(false);
  }, [path]);

  // Lock body scroll when the mobile drawer is open. Belt-and-braces; the
  // outer container is already overflow-hidden.
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [sidebarOpen]);

  return (
    <Ctx.Provider
      value={{
        openSidebar: () => setSidebarOpen(true),
        closeSidebar: () => setSidebarOpen(false),
        sidebarOpen,
      }}
    >
      <div className="h-screen flex bg-zinc-50 overflow-hidden">
        <Sidebar admin={admin} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
      </div>
    </Ctx.Provider>
  );
}
