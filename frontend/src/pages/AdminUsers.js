/**
 * Admin Users Page - User management (uses shared UserManagementSection)
 */
import React from 'react';
import { Users } from 'lucide-react';
import UserManagementSection from '../components/admin/UserManagementSection';

const AdminUsers = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-7 w-7" />
          User Management
        </h1>
        <p className="text-muted-foreground mt-1">View and search system users (students and staff)</p>
      </div>
      <UserManagementSection showHeader={true} />
    </div>
  );
};

export default AdminUsers;
