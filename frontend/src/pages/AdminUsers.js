
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
