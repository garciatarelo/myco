import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('myco_sidebar_collapsed');
    return saved !== null ? saved === 'true' : true;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  function handleToggleCollapse() {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('myco_sidebar_collapsed', String(next));
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#131313] text-white flex font-sans selection:bg-[#ff4500] selection:text-white">
      {/* Collapsible Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          onOpenMobile={() => setIsMobileOpen(true)}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
        <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
