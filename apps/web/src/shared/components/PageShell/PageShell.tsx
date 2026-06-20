import type { ReactNode } from 'react';
import { TopBar } from '../TopBar';
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
      <div className={wide ? 'appLayout__contentWide' : 'appLayout__content'}>
        {children}
      </div>
    </>
  );
}
