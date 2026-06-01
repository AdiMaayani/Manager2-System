import { NavLink, useNavigate } from 'react-router-dom';
import { clearAuthSession, getCurrentUser } from '@api/auth';
import { bottomNavItems, mainNavItems } from '@shared/layout/navItems';
import '@shared/layout/layout.css';

export function Sidebar() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  function handleLogout() {
    clearAuthSession();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="appLayout__sidebar">
      <nav className="sidebar__nav">
        <div className="sidebar__user">
          <div className="sidebar__userName">{user?.username ?? 'משתמש'}</div>
          <div className="sidebar__userRole">
            {user?.roles?.[0] ?? 'מחובר'}
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
          {mainNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
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
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
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
