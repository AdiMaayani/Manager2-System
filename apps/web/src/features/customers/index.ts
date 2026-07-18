export { CustomersPage } from './pages/CustomersPage';
export { CustomerDrawer } from './components/CustomerDrawer';
export { getCustomersAsync, getCustomerByIdAsync } from './api/customersApiClient';
export type { Customer } from './types';
export type { NestedCustomerDrawerIntent } from './lib/customerDrawerIntent';
export {
  isCanonicalCustomerLoadIntent,
  isNestedCustomerDrawerOpen,
  resolveCanonicalCustomerQueryId,
  resolveCustomerDrawerIntentAfterCustomerChange,
  shouldFetchCanonicalCustomerDetail,
  shouldInvokeCustomerCreatedOnSave,
} from './lib/customerDrawerIntent';
