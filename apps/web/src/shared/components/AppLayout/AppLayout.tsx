import { Outlet } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import '@shared/layout/layout.css';

export function AppLayout() {
  return (
    <div className="appLayout">
      <Sidebar />
      <main className="appLayout__main">
        <Outlet />
      </main>
    </div>
  );
}
