import { createBrowserRouter, Navigate } from 'react-router-dom';
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
import { CashflowPage } from '@features/cashflow';
import { SettingsPage } from '@features/settings';
import { AppLayout } from '@shared/components/AppLayout';
import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';

export const router = createBrowserRouter([
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
      { path: '/workplan', element: <WorkPlanPage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '/employees', element: <EmployeesPage /> },
      {
        path: '/users',
        element: (
          <AdminRoute>
            <UsersPage />
          </AdminRoute>
        ),
      },
      { path: '/contacts', element: <ContactsPage /> },
      { path: '/customers', element: <CustomersPage /> },
      { path: '/quotes', element: <QuotesPage /> },
      { path: '/inventory', element: <InventoryPage /> },
      { path: '/service-calls', element: <ServiceCallsPage /> },
      { path: '/cashflow', element: <CashflowPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
