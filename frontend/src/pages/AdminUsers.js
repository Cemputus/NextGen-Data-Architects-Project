/**
 * Admin Users Page - Full User Management experience.
 * Uses the same `UserManagementSection` layout as the Admin Console "Users" tab,
 * so admins see a consistent header, data view toggle, distribution chart, and table.
 */
import React from 'react';
import { PageContent } from '../components/ui/page-header';
import UserManagementSection from '../components/admin/UserManagementSection';

const AdminUsers = () => (
  <PageContent>
    <UserManagementSection
      showHeader={true}
      compact={false}
      showOpenFullPage={false}
    />
  </PageContent>
);

export default AdminUsers;
