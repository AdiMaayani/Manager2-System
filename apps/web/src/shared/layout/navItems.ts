import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  CalendarDays,
  FolderKanban,
  Wrench,
  Users,
  Contact,
  FileText,
  Package,
  Wallet,
  Settings,
  ClipboardList,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const mainNavItems: NavItem[] = [
  { path: '/', label: 'לוח בקרה', icon: LayoutDashboard },
  { path: '/workplan', label: 'תוכנית עבודה', icon: CalendarDays },
  { path: '/projects', label: 'פרויקטים', icon: FolderKanban },
  { path: '/service-calls', label: 'שירות', icon: Wrench },
  { path: '/customers', label: 'לקוחות', icon: Users },
  { path: '/contacts', label: 'אנשי קשר', icon: Contact },
  { path: '/quotes', label: 'הצעות מחיר', icon: FileText },
  { path: '/inventory', label: 'מלאי', icon: Package },
  { path: '/reports', label: 'דיווחים', icon: ClipboardList },
  { path: '/employees', label: 'עובדים', icon: Users },
];

export const bottomNavItems: NavItem[] = [
  { path: '/cashflow', label: 'תזרים', icon: Wallet },
  { path: '/settings', label: 'הגדרות', icon: Settings },
];
