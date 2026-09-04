import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import DashboardNavbar from './DashboardNavbar';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const location = useLocation();
  
  // Keep track of collapsed state on desktop (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

  // Mobile drawer open state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile sidebar drawer whenever route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const handleToggleSidebar = () => {
    // If desktop (width > 768px), toggle collapse state
    if (window.innerWidth > 768) {
      setIsCollapsed(prev => {
        const next = !prev;
        localStorage.setItem('sidebar_collapsed', String(next));
        return next;
      });
    } else {
      // If mobile, toggle open drawer state
      setIsMobileOpen(prev => !prev);
    }
  };

  const isEdgeToEdge = location.pathname.startsWith('/coding/') && location.pathname !== '/coding';

  return (
    <div className={`dashboard-layout ${isEdgeToEdge ? 'edge-to-edge-layout' : ''}`}>
      {/* Sidebar Overlay on mobile */}
      {isMobileOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <Sidebar 
        isCollapsed={isCollapsed} 
        isMobileOpen={isMobileOpen} 
        onToggleSidebar={handleToggleSidebar}
      />

      <div className={`dashboard-main ${isCollapsed ? 'collapsed' : ''} ${isEdgeToEdge ? 'edge-to-edge-main' : ''}`}>
        <DashboardNavbar onToggleSidebar={handleToggleSidebar} />
        <main className={`dashboard-content ${isEdgeToEdge ? 'edge-to-edge' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
