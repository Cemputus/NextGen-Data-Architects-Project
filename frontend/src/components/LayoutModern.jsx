/**
 * Modern Layout Component - UCU Style with Advanced Styling
 * Clean, smooth sidebar navigation with professional design
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logAuditEvent } from '../utils/audit';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Home, User, Settings, LogOut, 
  BarChart3, GraduationCap, Building2, Users, 
  DollarSign, Shield, FileText, TrendingUp, Menu, X
} from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const LayoutModern = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastPathRef = useRef(null);

  useEffect(() => {
    const path = location.pathname;
    if (user && path && path !== '/login' && path !== lastPathRef.current) {
      lastPathRef.current = path;
      logAuditEvent('page_view', 'navigation', path);
    }
  }, [location.pathname, user]);

  const getNavItems = () => {
    if (!user) return [];
    const role = user.role;
    
    const navItems = {
      student: [
        { path: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/student/grades', label: 'My Grades', icon: GraduationCap },
        { path: '/student/attendance', label: 'Attendance', icon: FileText },
        { path: '/student/payments', label: 'Payments', icon: DollarSign },
        { path: '/student/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/student/profile', label: 'Profile', icon: User },
      ],
      staff: [
        { path: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/staff/classes', label: 'My Classes', icon: GraduationCap },
        { path: '/staff/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/staff/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/staff/profile', label: 'Profile', icon: User },
      ],
      hod: [
        { path: '/hod/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/hod/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/hod/fex', label: 'FEX Analysis', icon: FileText },
        { path: '/hod/high-school', label: 'High School', icon: Building2 },
        { path: '/hod/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/hod/profile', label: 'Profile', icon: User },
      ],
      dean: [
        { path: '/dean/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/dean/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/dean/fex', label: 'FEX Analysis', icon: FileText },
        { path: '/dean/high-school', label: 'High School', icon: Building2 },
        { path: '/dean/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/dean/profile', label: 'Profile', icon: User },
      ],
      senate: [
        { path: '/senate/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/senate/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/senate/fex', label: 'FEX Analysis', icon: FileText },
        { path: '/senate/high-school', label: 'High School', icon: Building2 },
        { path: '/senate/finance', label: 'Finance', icon: DollarSign },
        { path: '/senate/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/senate/reports', label: 'Reports', icon: FileText },
        { path: '/senate/profile', label: 'Profile', icon: User },
      ],
      analyst: [
        { path: '/analyst/dashboard', label: 'Workspace', icon: LayoutDashboard },
        { path: '/analyst/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/analyst/fex', label: 'FEX Analysis', icon: FileText },
        { path: '/analyst/high-school', label: 'High School', icon: Building2 },
        { path: '/analyst/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/analyst/reports', label: 'Reports', icon: FileText },
        { path: '/analyst/profile', label: 'Profile', icon: User },
      ],
      sysadmin: [
        { path: '/admin/dashboard', label: 'Console', icon: Shield },
        { path: '/admin/users', label: 'Users', icon: Users },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
        { path: '/admin/etl', label: 'ETL Jobs', icon: BarChart3 },
        { path: '/admin/audit', label: 'Audit Logs', icon: FileText },
        { path: '/admin/profile', label: 'Profile', icon: User },
      ],
      hr: [
        { path: '/hr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/hr/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/hr/staff', label: 'Staff', icon: Users },
        { path: '/hr/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/hr/profile', label: 'Profile', icon: User },
      ],
      finance: [
        { path: '/finance/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/finance/analytics', label: 'Analytics', icon: BarChart3 },
        { path: '/finance/payments', label: 'Payments', icon: DollarSign },
        { path: '/finance/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/finance/profile', label: 'Profile', icon: User },
      ],
    };

    return navItems[role] || [];
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = getNavItems();
  const currentPath = location.pathname;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 flex">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 80 }}
        className="bg-white/80 backdrop-blur-xl border-r border-gray-200/50 hidden md:flex md:flex-col shadow-xl"
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-6 border-b border-gray-200/50">
            <div className="flex items-center justify-between">
              <AnimatePresence mode="wait">
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      NextGen MIS
                    </h1>
                    <p className="text-xs text-muted-foreground font-medium mt-1">
                      Data Architects
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="ml-auto h-9 w-9 hover:bg-blue-50 rounded-lg"
              >
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 h-11 font-medium transition-all duration-200",
                      isActive 
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700" 
                        : "hover:bg-blue-50 hover:text-blue-700 text-gray-700",
                      !sidebarOpen && "justify-center px-0"
                    )}
                    onClick={() => navigate(item.path)}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                  </Button>
                </motion.div>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-gray-200/50 bg-gradient-to-t from-gray-50/50 to-transparent">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-10 w-10 ring-2 ring-blue-200">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-semibold text-sm">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <Badge variant="secondary" className="text-xs mt-1 bg-blue-100 text-blue-700 border-blue-200">
                    {user?.role}
                  </Badge>
                </motion.div>
              )}
            </div>
            {sidebarOpen && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 h-10 font-medium rounded-lg"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full bg-white/95 backdrop-blur-xl border-r border-gray-200 z-50 w-64 md:hidden shadow-2xl"
            >
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      NextGen MIS
                    </h1>
                    <p className="text-xs text-muted-foreground font-medium mt-1">
                      Data Architects
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(false)}
                    className="h-9 w-9"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPath === item.path;
                    return (
                      <Button
                        key={item.path}
                        variant={isActive ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-3 h-11 font-medium",
                          isActive && "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                        )}
                        onClick={() => {
                          navigate(item.path);
                          setMobileMenuOpen(false);
                        }}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Button>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10 ring-2 ring-blue-200">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-semibold text-sm">
                        {user?.first_name?.[0]}{user?.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <Badge variant="secondary" className="text-xs mt-1 bg-blue-100 text-blue-700">
                        {user?.role}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 h-10 font-medium rounded-lg"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-gradient-to-r from-white via-blue-50/50 to-white backdrop-blur-xl border-b border-gray-200/50 px-4 md:px-6 py-4 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-10 w-10 hover:bg-blue-50 rounded-lg"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h2 className="text-xl font-bold text-gray-900">
                {navItems.find(item => item.path === currentPath)?.label || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <Avatar className="h-10 w-10 ring-2 ring-blue-200">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-semibold">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
          <div className="max-w-7xl mx-auto p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default LayoutModern;
