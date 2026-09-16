import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import DashboardNavbar from './DashboardNavbar';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Close mobile sidebar on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileOpen]);

  const handleToggleSidebar = () => {
    if (window.innerWidth > 768) {
      setIsCollapsed(prev => {
        const next = !prev;
        localStorage.setItem('sidebar_collapsed', String(next));
        return next;
      });
    } else {
      setIsMobileOpen(prev => !prev);
    }
  };

  const isEdgeToEdge = location.pathname.startsWith('/coding/') && location.pathname !== '/coding';

  return (
    <div className={`dashboard-layout ${isEdgeToEdge ? 'edge-to-edge-layout' : ''}`}>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
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
