/**
 * Admin Audit Logs Page - System audit logs (sysadmin only)
 */
import React from 'react';
import { PageHeader, PageContent } from '../components/ui/page-header';
import AuditLogSection from '../components/admin/AuditLogSection';

const AdminAudit = () => (
  <PageContent>
    <PageHeader
      title="Audit Logs"
      description="System activity and security audit trail"
    />
    <AuditLogSection showHeader={false} showSetupButton={true} compact={false} />
  </PageContent>
);

export default AdminAudit;
