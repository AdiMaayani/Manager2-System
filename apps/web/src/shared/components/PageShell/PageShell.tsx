import type { ReactNode } from 'react';
import { TopBar } from '../TopBar';
import { isMockDataMode } from '@/config/appConfig';
import '@shared/layout/layout.css';
import './PageShell.css';

interface PageShellProps {
  title: string;
  wide?: boolean;
  children: ReactNode;
}

export function PageShell({ title, wide = false, children }: PageShellProps) {
  return (
    <>
      <TopBar title={title} />
      {isMockDataMode && (
        <div className="pageShell__modeBanner">מצב נתונים: mock (ללא API)</div>
      )}
      <div className={wide ? 'appLayout__contentWide' : 'appLayout__content'}>
        {children}
      </div>
    </>
  );
}
