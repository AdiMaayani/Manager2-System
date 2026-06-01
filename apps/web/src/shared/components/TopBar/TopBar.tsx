import '@shared/layout/layout.css';

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header className="topBar">
      <div className="topBar__brand">
        <img src="/logo.png" alt="ManageR²" className="topBar__logo" />
        <div className="topBar__titleWrap">
          <h1 className="topBar__title">{title}</h1>
        </div>
      </div>
    </header>
  );
}
