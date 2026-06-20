import { NavLink, useNavigate } from 'react-router-dom';
import {
  clearAuthSession,
  clearReturnUrl,
  clearSessionExpiredNotice,
  getCurrentUser,
  getRoleDisplayLabel,
} from '@api/auth';
import { hasPermission } from '@shared/auth/permissions';
import { bottomNavItems, mainNavItems } from '@shared/layout/navItems';
import { useMobileNav } from '@shared/layout/MobileNavContext';
import '@shared/layout/layout.css';

interface SidebarProps {
  /** When the layout has collapsed the sidebar to an off-canvas panel, controls whether it is slid in. */
  isOpen?: boolean;
}

export function Sidebar({ isOpen = false }: SidebarProps) {
  const navigate = useNavigate();
  const { close: closeMobileNav } = useMobileNav();
  const user = getCurrentUser();
  const userRoles = user?.roles ?? [];
  const visibleMainNavItems = mainNavItems.filter(
    (item) => !item.requiredPermission || hasPermission(userRoles, item.requiredPermission),
  );
  const visibleBottomNavItems = bottomNavItems.filter(
    (item) => !item.requiredPermission || hasPermission(userRoles, item.requiredPermission),
  );

  function handleLogout() {
    // Deliberate sign-out: clear the session plus the one-shot "session expired" notice and any
    // stored return URL, so the next login shows a clean form rather than a stale expiry message.
    clearAuthSession();
    clearSessionExpiredNotice();
    clearReturnUrl();
    navigate('/login', { replace: true });
  }

  return (
    <aside
      className={`appLayout__sidebar${isOpen ? ' appLayout__sidebar--open' : ''}`}
    >
      <nav className="sidebar__nav">
        <div className="sidebar__user">
          <div className="sidebar__userName">{user?.username ?? 'משתמש'}</div>
          <div className="sidebar__userRole">
            {getRoleDisplayLabel(user?.roles?.[0])}
          </div>
          <div className="sidebar__userStatus">
            <span className="sidebar__statusDot" aria-hidden="true" />
            <span>מחובר</span>
          </div>
          <button type="button" className="sidebar__logout" onClick={handleLogout}>
            התנתק
          </button>
        </div>

        <div className="sidebar__navMain">
          {visibleMainNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={closeMobileNav}
              className={({ isActive }) =>
                `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
              }
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar__navBottom">
          {visibleBottomNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeMobileNav}
              className={({ isActive }) =>
                `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
              }
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
}
