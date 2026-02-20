/**
 * Main App Component with Role-Based Routing
 * Multi-page application with role-specific dashboards
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { rbac } from './utils/rbac';
import { Loader2 } from 'lucide-react';

// Layout
import LayoutModern from './components/LayoutModern';

// Auth
import Login from './components/Login';

// Role-specific Dashboards
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

// Shared Pages
import FEXAnalytics from './pages/FEXAnalytics';
import HighSchoolAnalytics from './pages/HighSchoolAnalytics';
import ProfilePage from './pages/ProfilePage';
import PredictionPage from './pages/PredictionPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ReportsPage from './pages/ReportsPage';

// Student Pages
import StudentGrades from './pages/StudentGrades';
import StudentAttendance from './pages/StudentAttendance';
import StudentPayments from './pages/StudentPayments';

// Staff Pages
import StaffClasses from './pages/StaffClasses';
import StaffAnalytics from './pages/StaffAnalytics';

// Admin Pages
import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';
import AdminETL from './pages/AdminETL';
import AdminAudit from './pages/AdminAudit';

// HR Pages
import HRStaff from './pages/HRStaff';

// Finance Pages
import FinancePayments from './pages/FinancePayments';
import SenateFinance from './pages/SenateFinance';

function PrivateRoute({ children, requiredRole = null }) {
  const { isAuthenticated, loading, user } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  const userRole = (user?.role || '').toString().toLowerCase();
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to={rbac.getDefaultRoute(userRole)} />;
  }
  
  return <LayoutModern>{children}</LayoutModern>;
}

function RoleRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  
  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to={rbac.getDefaultRoute(user?.role)} />;
  }
  
  return children;
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
      <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Student Routes */}
            <Route
              path="/student/*"
              element={
                <PrivateRoute requiredRole="student">
                  <Routes>
                    <Route path="dashboard" element={<StudentDashboard />} />
                    <Route path="grades" element={<StudentGrades />} />
                    <Route path="attendance" element={<StudentAttendance />} />
                    <Route path="payments" element={<StudentPayments />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="predictions" element={<PredictionPage />} />
                    <Route path="*" element={<Navigate to="/student/dashboard" />} />
                  </Routes>
                </PrivateRoute>
              }
            />
            
            {/* Staff Routes */}
            <Route
              path="/staff/*"
              element={
                <PrivateRoute requiredRole="staff">
                  <Routes>
                    <Route path="dashboard" element={<StaffDashboard />} />
                    <Route path="classes" element={<StaffClasses />} />
                    <Route path="analytics" element={<StaffAnalytics />} />
                    <Route path="predictions" element={<PredictionPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/staff/dashboard" />} />
                  </Routes>
                </PrivateRoute>
              }
            />
            
            {/* HOD Routes */}
            <Route
              path="/hod/*"
              element={
                <PrivateRoute requiredRole="hod">
                  <Routes>
                    <Route path="dashboard" element={<HODDashboard />} />
                    <Route path="assign-classes" element={<HODAssignClasses />} />
                    <Route path="analytics" element={<AnalyticsPage type="hod" />} />
                    <Route path="fex" element={<FEXAnalytics />} />
                    <Route path="high-school" element={<HighSchoolAnalytics />} />
                    <Route path="predictions" element={<PredictionPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/hod/dashboard" />} />
                  </Routes>
                </PrivateRoute>
              }
            />
            
            {/* Dean Routes */}
            <Route
              path="/dean/*"
              element={
                <PrivateRoute requiredRole="dean">
                  <Routes>
                    <Route path="dashboard" element={<DeanDashboard />} />
                    <Route path="analytics" element={<AnalyticsPage type="dean" />} />
                    <Route path="fex" element={<FEXAnalytics />} />
                    <Route path="high-school" element={<HighSchoolAnalytics />} />
                    <Route path="predictions" element={<PredictionPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/dean/dashboard" />} />
                  </Routes>
                </PrivateRoute>
              }
            />
            
            {/* Senate Routes */}
            <Route
              path="/senate/*"
              element={
                <PrivateRoute requiredRole="senate">
                  <Routes>
                    <Route path="dashboard" element={<SenateDashboard />} />
                    <Route path="analytics" element={<AnalyticsPage type="senate" />} />
                    <Route path="fex" element={<FEXAnalytics />} />
                    <Route path="high-school" element={<HighSchoolAnalytics />} />
                    <Route path="finance" element={<SenateFinance />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="predictions" element={<PredictionPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/senate/dashboard" />} />
                  </Routes>
                </PrivateRoute>
              }
            />
            
            {/* Analyst Routes */}
            <Route
              path="/analyst/*"
              element={
                <PrivateRoute requiredRole="analyst">
                  <Routes>
                    <Route path="dashboard" element={<AnalystDashboard />} />
                    <Route path="analytics" element={<AnalyticsPage type="analyst" />} />
                    <Route path="fex" element={<FEXAnalytics />} />
                    <Route path="high-school" element={<HighSchoolAnalytics />} />
                    <Route path="predictions" element={<PredictionPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/analyst/dashboard" />} />
                  </Routes>
                </PrivateRoute>
              }
            />
            
            {/* Admin Routes */}
            <Route
              path="/admin/*"
              element={
                <PrivateRoute requiredRole="sysadmin">
                  <Routes>
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="etl" element={<AdminETL />} />
                    <Route path="audit" element={<AdminAudit />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/admin/dashboard" />} />
                  </Routes>
                </PrivateRoute>
              }
            />
            
            {/* HR Routes */}
            <Route
              path="/hr/*"
              element={
                <PrivateRoute requiredRole="hr">
                  <Routes>
                    <Route path="dashboard" element={<HRDashboard />} />
                    <Route path="analytics" element={<AnalyticsPage type="hr" />} />
                    <Route path="staff" element={<HRStaff />} />
                    <Route path="predictions" element={<PredictionPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/hr/dashboard" />} />
                  </Routes>
                </PrivateRoute>
              }
            />
            
            {/* Finance Routes */}
            <Route
              path="/finance/*"
              element={
                <PrivateRoute requiredRole="finance">
                  <Routes>
                    <Route path="dashboard" element={<FinanceDashboard />} />
                    <Route path="analytics" element={<AnalyticsPage type="finance" />} />
                    <Route path="payments" element={<FinancePayments />} />
                    <Route path="predictions" element={<PredictionPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/finance/dashboard" />} />
                  </Routes>
                </PrivateRoute>
              }
            />
            
            {/* Default Route - Redirect based on role */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Navigate to="/dashboard" />
                </PrivateRoute>
              }
            />
            
            {/* Legacy dashboard route - redirect to role-specific */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <RoleRedirect />
                </PrivateRoute>
              }
            />
          </Routes>
        </Router>
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
