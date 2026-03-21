/**
 * Dean / Faculty dashboard — same KPIs and charts as the analytics workspace,
 * scoped to the dean's faculty. Faculty is fixed from the JWT; filters start at Department → Program.
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';
import AnalystDashboard from './AnalystDashboard';

const DeanDashboard = () => {
  const { user } = useAuth();
  const fid = user?.faculty_id;

  return (
    <>
      {fid == null || fid === '' ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-800">
          Your account has no <strong>faculty</strong> assigned. Ask an administrator to set your faculty so analytics stay scoped correctly.
        </div>
      ) : null}
    <AnalystDashboard
      title="Faculty Dashboard"
      defaultSubtitle="Analytics for your faculty — filter by department, program, semester, and more."
      exportFilename="dean_workspace"
      filterPageName="dean_analytics"
      lockedFacultyId={fid != null && fid !== '' ? fid : undefined}
    />
    </>
  );
};

export default DeanDashboard;
