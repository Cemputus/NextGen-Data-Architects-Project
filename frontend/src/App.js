
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PersistentToastProvider } from './context/PersistentToastContext';
import { PredictionWorkspaceProvider } from './context/PredictionWorkspaceContext';
import { rbac } from './utils/rbac';
import { Loader2 } from 'lucide-react';

import LayoutModern from './components/LayoutModern';

import Login from './components/Login';

import StudentDashboard from './pages/StudentDashboard';
import StaffDashboard from './pages/StaffDashboard';
import HODDashboard from './pages/HODDashboard';
import HODAssignClasses from './pages/HODAssignClasses';
import DeanDashboard from './pages/DeanDashboard';
import SenateDashboard from './pages/SenateDashboard';
import AnalystDashboard from './pages/AnalystDashboard';
import AdminDashboard from './pages/AdminDashboard';
import HRDashboard from './pages/HRDashboard';
import FinanceDashboard from './pages/FinanceDashboard';
import AcademicRiskDashboard from './pages/AcademicRiskDashboard';

import FEXAnalytics from './pages/FEXAnalytics';
import RecruitmentAnalytics from './pages/RecruitmentAnalytics';
import ProfilePage from './pages/ProfilePage';
import PredictionPage from './pages/PredictionPage';
import ReportsPage from './pages/ReportsPage';
import NextGenQueryPage from './pages/NextGenQueryPage';
import AnalystDashboardsPage from './pages/AnalystDashboardsPage';
import ManagedSharedChartsPage from './pages/ManagedSharedChartsPage';

import StudentGrades from './pages/StudentGrades';
import StudentAttendance from './pages/StudentAttendance';
import StudentPayments from './pages/StudentPayments';

import StaffClasses from './pages/StaffClasses';

import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';
import AdminETL from './pages/AdminETL';
import AdminETLNotifications from './pages/AdminETLNotifications';
import AdminAudit from './pages/AdminAudit';

import HRStaff from './pages/HRStaff';

import FinancePayments from './pages/FinancePayments';
import SenateFinance from './pages/SenateFinance';
import SharedViewsPage from './pages/SharedViewsPage';
import UserInfoPage from './pages/UserInfoPage';
import HREmployeesPage from './pages/HREmployeesPage';
import HRLeaveRequestsPage from './pages/HRLeaveRequestsPage';
import HRPayrollPage from './pages/HRPayrollPage';
import HREvaluationPage from './pages/HREvaluationPage';

function PrivateRoute({ children, requiredRole = null, allowedRoles = null }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  const userRole = (user?.role || '').toString().toLowerCase();
  if (allowedRoles && Array.isArray(allowedRoles)) {
    const allowed = allowedRoles.map((r) => (r || '').toString().toLowerCase());
    if (!allowed.includes(userRole)) {
      return <Navigate to={rbac.getDefaultRoute(userRole)} />;
    }
  } else if (requiredRole && userRole !== requiredRole) {
    return <Navigate to={rbac.getDefaultRoute(userRole)} />;
  }

  return <LayoutModern>{children}</LayoutModern>;
}

function RoleRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  const userRole = (user?.role || '').toString().toLowerCase();
  const allowed = Array.isArray(allowedRoles) ? allowedRoles.map((r) => (r || '').toString().toLowerCase()) : [];

  if (!allowed.includes(userRole)) {
    return <Navigate to={rbac.getDefaultRoute(userRole)} />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <PersistentToastProvider>
          <Router>
            <PredictionWorkspaceProvider>
            <Routes>
              {}
              <Route path="/login" element={<Login />} />

              {}
              <Route
                path="/student/*"
                element={
                  <PrivateRoute requiredRole="student">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<StudentDashboard />} />
                      <Route path="grades" element={<StudentGrades />} />
                      <Route path="attendance" element={<StudentAttendance />} />
                      <Route path="payments" element={<StudentPayments />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="user-info" element={<UserInfoPage />} />
                      <Route path="predictions" element={<PredictionPage />} />
                      <Route path="shared-views" element={<SharedViewsPage />} />
                      <Route path="managed-shared-charts" element={<ManagedSharedChartsPage />} />
                      <Route path="*" element={<Navigate to="/student/dashboard" />} />
                    </Routes>
                  </PrivateRoute>
                }
              />

              {}
              <Route
                path="/staff/*"
                element={
                  <PrivateRoute requiredRole="staff">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<StaffDashboard />} />
                      <Route path="classes" element={<StaffClasses />} />
                      <Route path="analytics" element={<Navigate to="/staff/dashboard" replace />} />
                      <Route path="predictions" element={<PredictionPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="leave-requests" element={<HRLeaveRequestsPage />} />
                      <Route path="user-info" element={<UserInfoPage />} />
                      <Route path="shared-views" element={<SharedViewsPage />} />
                      <Route path="managed-shared-charts" element={<ManagedSharedChartsPage />} />
                      <Route path="*" element={<Navigate to="/staff/dashboard" />} />
                    </Routes>
                  </PrivateRoute>
                }
              />

              {}
              <Route
                path="/hod/*"
                element={
                  <PrivateRoute requiredRole="hod">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<HODDashboard />} />
                      <Route path="assign-classes" element={<HODAssignClasses />} />
                      <Route path="analytics" element={<Navigate to="/hod/dashboard" replace />} />
                      <Route path="fex" element={<FEXAnalytics />} />
                      <Route path="recruitment" element={<RecruitmentAnalytics />} />
                      <Route path="risk" element={<AcademicRiskDashboard />} />
                      <Route path="predictions" element={<PredictionPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="leave-requests" element={<HRLeaveRequestsPage />} />
                      <Route path="user-info" element={<UserInfoPage />} />
                      <Route path="shared-views" element={<SharedViewsPage />} />
                      <Route path="managed-shared-charts" element={<ManagedSharedChartsPage />} />
                      <Route path="*" element={<Navigate to="/hod/dashboard" />} />
                    </Routes>
                  </PrivateRoute>
                }
              />

              {}
              <Route
                path="/dean/*"
                element={
                  <PrivateRoute requiredRole="dean">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<DeanDashboard />} />
                      <Route path="analytics" element={<Navigate to="/dean/dashboard" replace />} />
                      <Route path="fex" element={<FEXAnalytics />} />
                      <Route path="recruitment" element={<RecruitmentAnalytics />} />
                      <Route path="risk" element={<AcademicRiskDashboard />} />
                      <Route path="predictions" element={<PredictionPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="user-info" element={<UserInfoPage />} />
                      <Route path="shared-views" element={<SharedViewsPage />} />
                      <Route path="managed-shared-charts" element={<ManagedSharedChartsPage />} />
                      <Route path="*" element={<Navigate to="/dean/dashboard" />} />
                    </Routes>
                  </PrivateRoute>
                }
              />

              {}
              <Route
                path="/senate/*"
                element={
                  <PrivateRoute requiredRole="senate">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<SenateDashboard />} />
                      <Route path="analytics" element={<Navigate to="/senate/dashboard" replace />} />
                      <Route path="fex" element={<FEXAnalytics />} />
                      <Route path="recruitment" element={<RecruitmentAnalytics />} />
                      <Route path="risk" element={<AcademicRiskDashboard />} />
                      <Route path="finance" element={<SenateFinance />} />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="predictions" element={<PredictionPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="leave-requests" element={<HRLeaveRequestsPage />} />
                      <Route path="user-info" element={<UserInfoPage />} />
                      <Route path="shared-views" element={<SharedViewsPage />} />
                      <Route path="managed-shared-charts" element={<ManagedSharedChartsPage />} />
                      <Route path="*" element={<Navigate to="/senate/dashboard" />} />
                    </Routes>
                  </PrivateRoute>
                }
              />

              {}
              <Route
                path="/analyst/*"
                element={
                  <PrivateRoute allowedRoles={['analyst', 'sysadmin']}>
                    <Routes>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<AnalystDashboard />} />
                      <Route path="analytics" element={<Navigate to="/analyst/dashboard" replace />} />
                      <Route path="dashboards" element={<AnalystDashboardsPage />} />
                      <Route path="fex" element={<FEXAnalytics />} />
                      <Route path="recruitment" element={<RecruitmentAnalytics />} />
                      <Route path="risk" element={<AcademicRiskDashboard />} />
                      <Route path="predictions" element={<PredictionPage />} />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="query" element={<NextGenQueryPage />} />
                      <Route path="managed-shared-charts" element={<ManagedSharedChartsPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="leave-requests" element={<HRLeaveRequestsPage />} />
                      <Route path="user-info" element={<UserInfoPage />} />
                      <Route path="shared-views" element={<SharedViewsPage />} />
                      <Route path="*" element={<Navigate to="/analyst/dashboard" />} />
                    </Routes>
                  </PrivateRoute>
                }
              />

              {}
              <Route
                path="/admin/*"
                element={
                  <PrivateRoute allowedRoles={['sysadmin', 'admin']}>
                    <Routes>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="etl" element={<AdminETL />} />
                      <Route path="etl-notifications" element={<AdminETLNotifications />} />
                      <Route path="audit" element={<AdminAudit />} />
                      <Route path="predictions" element={<PredictionPage />} />
                      <Route path="shared-views" element={<SharedViewsPage />} />
                      <Route path="managed-shared-charts" element={<ManagedSharedChartsPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="leave-requests" element={<HRLeaveRequestsPage />} />
                      <Route path="user-info" element={<UserInfoPage />} />
                      <Route path="*" element={<Navigate to="/admin/dashboard" />} />
                    </Routes>
                  </PrivateRoute>
                }
              />

              {}
              <Route
                path="/hr/*"
                element={
                  <PrivateRoute requiredRole="hr">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<HRDashboard />} />
                      <Route path="analytics" element={<Navigate to="/hr/dashboard" replace />} />
                      <Route path="employees" element={<HREmployeesPage />} />
                      <Route path="staff" element={<HRStaff />} />
                      <Route path="leave-requests" element={<HRLeaveRequestsPage />} />
                      <Route path="payroll" element={<HRPayrollPage />} />
                      <Route path="evaluation" element={<HREvaluationPage />} />
                      <Route path="predictions" element={<PredictionPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="user-info" element={<UserInfoPage />} />
                      <Route path="shared-views" element={<SharedViewsPage />} />
                      <Route path="managed-shared-charts" element={<ManagedSharedChartsPage />} />
                      <Route path="*" element={<Navigate to="/hr/dashboard" />} />
                    </Routes>
                  </PrivateRoute>
                }
              />

              {}
              <Route
                path="/finance/*"
                element={
                  <PrivateRoute requiredRole="finance">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={<FinanceDashboard />} />
                      <Route path="analytics" element={<Navigate to="/finance/dashboard" replace />} />
                      <Route path="payments" element={<FinancePayments />} />
                      <Route path="predictions" element={<PredictionPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="user-info" element={<UserInfoPage />} />
                      <Route path="shared-views" element={<SharedViewsPage />} />
                      <Route path="managed-shared-charts" element={<ManagedSharedChartsPage />} />
                      <Route path="*" element={<Navigate to="/finance/dashboard" />} />
                    </Routes>
                  </PrivateRoute>
                }
              />

              {}
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Navigate to="/dashboard" />
                  </PrivateRoute>
                }
              />

              {}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <RoleRedirect />
                  </PrivateRoute>
                }
              />
            </Routes>
            </PredictionWorkspaceProvider>
          </Router>
        </PersistentToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

function RoleRedirect() {
  const { user } = useAuth();
  const defaultRoute = rbac.getDefaultRoute(user?.role);
  return <Navigate to={defaultRoute} />;
}

export default App;
