import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@features/auth';
import { DashboardPage } from '@features/dashboard';
import { WorkPlanPage } from '@features/workplan';
import { ProjectsPage } from '@features/projects';
import { ReportsPage } from '@features/reports';
import { EmployeesPage } from '@features/employees';
import { UsersPage } from '@features/users';
import { ContactsPage } from '@features/contacts';
import { CustomersPage } from '@features/customers';
import { QuotesPage } from '@features/quotes';
import { InventoryPage } from '@features/inventory';
import { ServiceCallsPage } from '@features/serviceCalls';
import { SettingsPage } from '@features/settings';
import { AuditLogPage } from '@features/audit';
import { AppLayout } from '@shared/components/AppLayout';
import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { RequirePermission } from './RequirePermission';

const createRouter =
  import.meta.env.BASE_URL === '/'
    ? createBrowserRouter
    : createHashRouter;

export const router = createRouter([
  { path: '/Users/login', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <DashboardPage /> },
      {
        path: '/workplan',
        element: (
          <RequirePermission permission="viewWorkPlan">
            <WorkPlanPage />
          </RequirePermission>
        ),
      },
      {
        path: '/projects',
        element: (
          <RequirePermission permission="viewProjects">
            <ProjectsPage />
          </RequirePermission>
        ),
      },
      {
        path: '/reports',
        element: (
          <RequirePermission permission="viewReports">
            <ReportsPage />
          </RequirePermission>
        ),
      },
      {
        path: '/employees',
        element: (
          <RequirePermission permission="viewEmployees">
            <EmployeesPage />
          </RequirePermission>
        ),
      },
      {
        path: '/users',
        element: (
          <AdminRoute>
            <UsersPage />
          </AdminRoute>
        ),
      },
      {
        path: '/contacts',
        element: (
          <RequirePermission permission="viewContacts">
            <ContactsPage />
          </RequirePermission>
        ),
      },
      {
        path: '/customers',
        element: (
          <RequirePermission permission="viewCustomers">
            <CustomersPage />
          </RequirePermission>
        ),
      },
      {
        path: '/quotes',
        element: (
          <RequirePermission permission="viewQuotes">
            <QuotesPage />
          </RequirePermission>
        ),
      },
      {
        path: '/inventory',
        element: (
          <RequirePermission permission="viewInventory">
            <InventoryPage />
          </RequirePermission>
        ),
      },
      {
        path: '/service-calls',
        element: (
          <RequirePermission permission="viewServiceCalls">
            <ServiceCallsPage />
          </RequirePermission>
        ),
      },
      { path: '/cashflow', element: <Navigate to="/" replace /> },
      {
        path: '/audit',
        element: (
          <RequirePermission permission="viewAuditLog">
            <AuditLogPage />
          </RequirePermission>
        ),
      },
      {
        path: '/settings',
        element: (
          <RequirePermission permission="viewSettings">
            <SettingsPage />
          </RequirePermission>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
