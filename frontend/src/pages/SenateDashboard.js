/**
 * Senate Dashboard — same analytics workspace (KPIs + charts + global filters) as the analyst view.
 * Every user with role `senate` hits this page via `/senate/dashboard`; data scope is enforced by the API/JWT.
 */
import React from 'react';
import AnalystDashboard from './AnalystDashboard';

const SenateDashboard = () => (
  <AnalystDashboard
    title="Senate Dashboard"
    defaultSubtitle="Institution-wide analytics and comprehensive reporting"
    exportFilename="senate_dashboard"
    filterPageName="senate_dashboard"
  />
);

export default SenateDashboard;
