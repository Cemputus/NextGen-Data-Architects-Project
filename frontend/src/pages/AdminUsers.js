/**
 * Admin Users Page - User management (uses shared UserManagementSection)
 */
import React from 'react';
import { PageHeader, PageContent } from '../components/ui/page-header';
import UserManagementSection from '../components/admin/UserManagementSection';

const AdminUsers = () => {
  return (
    <PageContent>
      <PageHeader
        title="User Management"
        description="View and search system users (students and staff)"
      />
      <UserManagementSection showHeader={false} />
    </PageContent>
  );
};
export default AdminUsers;
