import type { ReactNode } from 'react';
import './Tabs.css';

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
}

export function Tabs({ tabs, activeTabId, onTabChange, children }: TabsProps) {
  return (
    <div className="tabs">
      <div className="tabs__bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTabId === tab.id}
            className={`tabs__tab ${activeTabId === tab.id ? 'tabs__tab--active' : ''}`.trim()}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tabs__panel" role="tabpanel">
        {children}
      </div>
    </div>
  );
}
