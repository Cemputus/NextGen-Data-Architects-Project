/**
 * Admin Audit Logs Page - System audit logs (sysadmin only)
 * Uses AuditLogSection with ETL-style "Show last N" filter.
 */
import React from 'react';
import AuditLogSection from '../components/admin/AuditLogSection';

const AdminAudit = () => {
  return (
    <div className="space-y-6">
      <AuditLogSection showHeader={true} showSetupButton={true} compact={false} />
    </div>
  );
};

export default AdminAudit;
