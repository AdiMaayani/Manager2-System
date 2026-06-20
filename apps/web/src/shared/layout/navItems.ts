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
  Settings,
  ClipboardList,
  ScrollText,
} from 'lucide-react';
import type { Permission } from '@shared/auth/permissions';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  // When set, the item is only shown to users whose roles grant this permission.
  // Items without a permission (e.g. the dashboard) are visible to every authenticated user.
  requiredPermission?: Permission;
}

export const mainNavItems: NavItem[] = [
  { path: '/', label: 'לוח בקרה', icon: LayoutDashboard },
  { path: '/workplan', label: 'תוכנית עבודה', icon: CalendarDays, requiredPermission: 'viewWorkPlan' },
  { path: '/projects', label: 'פרויקטים', icon: FolderKanban, requiredPermission: 'viewProjects' },
  { path: '/service-calls', label: 'שירות', icon: Wrench, requiredPermission: 'viewServiceCalls' },
  { path: '/customers', label: 'לקוחות', icon: Users, requiredPermission: 'viewCustomers' },
  { path: '/contacts', label: 'אנשי קשר', icon: Contact, requiredPermission: 'viewContacts' },
  { path: '/quotes', label: 'הצעות מחיר', icon: FileText, requiredPermission: 'viewQuotes' },
  { path: '/inventory', label: 'מלאי', icon: Package, requiredPermission: 'viewInventory' },
  { path: '/reports', label: 'דיווחים', icon: ClipboardList, requiredPermission: 'viewReports' },
  { path: '/employees', label: 'עובדים', icon: Users, requiredPermission: 'viewEmployees' },
  { path: '/users', label: 'ניהול משתמשים', icon: Users, requiredPermission: 'viewUsers' },
];

export const bottomNavItems: NavItem[] = [
  { path: '/audit', label: 'יומן ביקורת', icon: ScrollText, requiredPermission: 'viewAuditLog' },
  { path: '/settings', label: 'הגדרות', icon: Settings, requiredPermission: 'viewSettings' },
];
