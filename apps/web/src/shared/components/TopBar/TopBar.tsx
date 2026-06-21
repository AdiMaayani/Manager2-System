import { Menu } from 'lucide-react';
import { useMobileNav } from '@shared/layout/MobileNavContext';
import '@shared/layout/layout.css';

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { toggle, isOpen } = useMobileNav();

  return (
    <header className="topBar">
      <button
        type="button"
        className="topBar__navToggle"
        onClick={toggle}
        aria-label="פתיחת תפריט הניווט"
        aria-expanded={isOpen}
      >
        <Menu size={22} aria-hidden="true" />
      </button>
      <div className="topBar__brand">
        <span className="topBar__logoWrap" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ManageR²" className="topBar__logo" />
        </span>
        <div className="topBar__titleWrap">
          <h1 className="topBar__title">{title}</h1>
        </div>
      </div>
    </header>
  );
}
