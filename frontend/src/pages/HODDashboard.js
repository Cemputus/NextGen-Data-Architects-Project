
import React from 'react';
import { useAuth } from '../context/AuthContext';
import AnalystDashboard from './AnalystDashboard';

const HODDashboard = () => {
  const { user } = useAuth();
  const did = user?.department_id;

  return (
    <>
      {did == null || did === '' ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-800">
          Your account has no <strong>department</strong> assigned. Ask an administrator to set your department so analytics stay scoped correctly.
        </div>
      ) : null}
      <AnalystDashboard
        title="Department Dashboard"
        defaultSubtitle="Analytics for your department — filter by program, course, semester, and more."
        exportFilename="hod_workspace"
        filterPageName="hod_analytics"
        lockedDepartmentId={did != null && did !== '' ? did : undefined}
      />
    </>
  );
};

export default HODDashboard;
