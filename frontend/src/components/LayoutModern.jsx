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
  DollarSign, Shield, FileText, TrendingUp, Menu, X, Database, Bell, Clock, Share2, History, LineChart, ShieldAlert
} from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import CountdownTimer from './admin/CountdownTimer';
import axios from 'axios';

const LayoutModern = ({ children }) => {
  const { user, logout, sessionWarning, dismissWarning } = useAuth();
  const profilePhotoUrl = useProfilePhoto(user?.profile_picture_url);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastPathRef = useRef(null);
  const [etlRunCount, setEtlRunCount] = useState(null);
  const [etlRunsList, setEtlRunsList] = useState([]);
  const etlRunsListRef = useRef([]);
  const [adminSettings, setAdminSettings] = useState({});
  const [etlCountdownSec, setEtlCountdownSec] = useState(null);

  const getNavItems = () => {
    if (!user) return [];
    const role = (user.role || '').toString().toLowerCase();
    const navItems = {
      student: [
        { path: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/student/shared-views', label: 'Views shared with you', icon: Share2 },
        { path: '/student/managed-shared-charts', label: 'Charts I shared', icon: BarChart3 },
        { path: '/student/grades', label: 'My Grades', icon: GraduationCap },
        { path: '/student/attendance', label: 'Attendance', icon: Clock },
        { path: '/student/payments', label: 'Payments', icon: DollarSign },
        { path: '/student/predictions', label: 'Predictions', icon: TrendingUp },
        // No User Info option for students
        { path: '/student/profile', label: 'Profile', icon: User },
      ],
      staff: [
        { path: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/staff/shared-views', label: 'Views shared with you', icon: Share2 },
        { path: '/staff/managed-shared-charts', label: 'Charts I shared', icon: BarChart3 },
        { path: '/staff/classes', label: 'My Classes', icon: GraduationCap },
        { path: '/staff/analytics', label: 'Analytics', icon: Database },
        { path: '/staff/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/staff/user-info', label: 'User Info', icon: FileText },
        { path: '/staff/profile', label: 'Profile', icon: User },
      ],
      hod: [
        { path: '/hod/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/hod/shared-views', label: 'Views shared with you', icon: Share2 },
        { path: '/hod/managed-shared-charts', label: 'Charts I shared', icon: BarChart3 },
        { path: '/hod/assign-classes', label: 'Assign classes', icon: GraduationCap },
        { path: '/hod/analytics', label: 'Analytics', icon: Database },
        { path: '/hod/risk', label: 'Risk Analysis', icon: ShieldAlert },
        { path: '/hod/fex', label: 'FEX Analysis', icon: Shield },
        { path: '/hod/high-school', label: 'High School BI', icon: Building2 },
        { path: '/hod/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/hod/user-info', label: 'User Info', icon: FileText },
        { path: '/hod/profile', label: 'Profile', icon: User },
      ],
      dean: [
        { path: '/dean/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/dean/shared-views', label: 'Views shared with you', icon: Share2 },
        { path: '/dean/managed-shared-charts', label: 'Charts I shared', icon: BarChart3 },
        { path: '/dean/analytics', label: 'Analytics', icon: Database },
        { path: '/dean/risk', label: 'Risk Analysis', icon: ShieldAlert },
        { path: '/dean/fex', label: 'FEX Analysis', icon: Shield },
        { path: '/dean/high-school', label: 'High School BI', icon: Building2 },
        { path: '/dean/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/dean/user-info', label: 'User Info', icon: FileText },
        { path: '/dean/profile', label: 'Profile', icon: User },
      ],
      senate: [
        { path: '/senate/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/senate/shared-views', label: 'Views shared with you', icon: Share2 },
        { path: '/senate/managed-shared-charts', label: 'Charts I shared', icon: BarChart3 },
        { path: '/senate/analytics', label: 'Analytics', icon: Database },
        { path: '/senate/risk', label: 'Risk Analysis', icon: ShieldAlert },
        { path: '/senate/fex', label: 'FEX Analysis', icon: Shield },
        { path: '/senate/high-school', label: 'High School BI', icon: Building2 },
        { path: '/senate/finance', label: 'Finance BI', icon: DollarSign },
        { path: '/senate/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/senate/reports', label: 'Reports', icon: History },
        { path: '/senate/user-info', label: 'User Info', icon: FileText },
        { path: '/senate/profile', label: 'Profile', icon: User },
      ],
      analyst: [
        { path: '/analyst/dashboard', label: 'Workspace', icon: Home },
        { path: '/analyst/shared-views', label: 'Views shared with you', icon: Share2 },
        { path: '/analyst/managed-shared-charts', label: 'Managed shared Charts', icon: BarChart3 },
        // Swapped icons: Analytics now uses the LineChart icon, NextGen Query uses the Database icon.
        { path: '/analyst/analytics', label: 'Analytics', icon: LineChart },
        { path: '/analyst/dashboards', label: 'Dashboards', icon: LayoutDashboard },
        { path: '/analyst/query', label: 'NextGen Query', icon: Database },
        { path: '/analyst/risk', label: 'Risk Analysis', icon: ShieldAlert },
        { path: '/analyst/fex', label: 'FEX Analysis', icon: Shield },
        { path: '/analyst/high-school', label: 'High School BI', icon: Building2 },
        { path: '/analyst/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/analyst/reports', label: 'Reports', icon: History },
        { path: '/analyst/user-info', label: 'User Info', icon: FileText },
        { path: '/analyst/profile', label: 'Profile', icon: User },
      ],
      sysadmin: [
        { path: '/admin/dashboard', label: 'Console', icon: Shield },
        { path: '/admin/shared-views', label: 'Views shared with you', icon: Share2 },
        { path: '/admin/managed-shared-charts', label: 'Charts I shared', icon: BarChart3 },
        { path: '/admin/users', label: 'Users', icon: Users },
        { path: '/admin/settings', label: 'Settings', icon: Settings },
        { path: '/admin/etl', label: 'ETL Jobs', icon: Database },
        { path: '/admin/etl-notifications', label: 'ETL Notifications', icon: Bell },
        { path: '/admin/audit', label: 'Audit Logs', icon: History },
        { path: '/admin/user-info', label: 'User Info', icon: FileText },
        { path: '/admin/profile', label: 'Profile', icon: User },
      ],
      hr: [
        { path: '/hr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/hr/shared-views', label: 'Views shared with you', icon: Share2 },
        { path: '/hr/managed-shared-charts', label: 'Charts I shared', icon: BarChart3 },
        { path: '/hr/analytics', label: 'Analytics', icon: Database },
        { path: '/hr/employees', label: 'Employees', icon: Users },
        { path: '/hr/staff', label: 'Staff', icon: User },
        { path: '/hr/leave-requests', label: 'Leave Requests', icon: Clock },
        { path: '/hr/payroll', label: 'Payroll', icon: DollarSign },
        { path: '/hr/evaluation', label: 'Evaluation', icon: Shield },
        { path: '/hr/user-info', label: 'User Info', icon: FileText },
        { path: '/hr/profile', label: 'Profile', icon: History },
      ],
      finance: [
        { path: '/finance/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/finance/shared-views', label: 'Views shared with you', icon: Share2 },
        { path: '/finance/managed-shared-charts', label: 'Charts I shared', icon: BarChart3 },
        { path: '/finance/analytics', label: 'Analytics', icon: Database },
        { path: '/finance/payments', label: 'Payments', icon: DollarSign },
        { path: '/finance/predictions', label: 'Predictions', icon: TrendingUp },
        { path: '/finance/user-info', label: 'User Info', icon: FileText },
        { path: '/finance/profile', label: 'Profile', icon: User },
      ],
    };

    return navItems[role] || [];
  };

  useEffect(() => {
    const path = location.pathname;
    if (!user || !path || path === '/login' || path === lastPathRef.current) return;
    lastPathRef.current = path;
    const navItems = getNavItems();
    const match = navItems.find((item) => item.path === path);
    const pageName = match ? match.label : path.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || path;
    const actionName = typeof pageName === 'string' ? pageName.charAt(0).toUpperCase() + pageName.slice(1) : pageName;
    logAuditEvent(actionName, 'navigation', path);
  }, [location.pathname, user]);

  const ADMIN_ETL_READ_KEY = 'admin_etl_read_logs';

  const getReadLogs = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(ADMIN_ETL_READ_KEY) || '[]'));
    } catch {
      return new Set();
    }
  };

  const unreadCount = (list) => {
    const read = getReadLogs();
    return list.filter((r) => !read.has(r.log_file)).length;
  };

  // ETL run list + unread count for sysadmin sidebar badge; listen for read updates
  useEffect(() => {
    const role = (user?.role || '').toString().toLowerCase();
    if (role !== 'sysadmin') {
      setEtlRunCount(null);
      setEtlRunsList([]);
      return;
    }
    let cancelled = false;
    const token = sessionStorage.getItem('ucu_session_token');
    if (!token) return;
    const fetchList = () => {
      axios
        .get('/api/admin/system-status', {
          headers: { Authorization: `Bearer ${token}` },
          params: { etl_runs_limit: 100 },
        })
        .then((res) => {
          if (!cancelled && res.data && Array.isArray(res.data.etl_runs)) {
            const list = res.data.etl_runs;
            etlRunsListRef.current = list;
            setEtlRunsList(list);
            setEtlRunCount(unreadCount(list));
          }
        })
        .catch(() => {
          if (!cancelled) setEtlRunCount(null);
          etlRunsListRef.current = [];
          setEtlRunsList([]);
        });
    };
    fetchList();
    const onReadUpdate = () => {
      const list = etlRunsListRef.current;
      if (list && list.length > 0) setEtlRunCount(unreadCount(list));
    };
    window.addEventListener('admin-etl-read-update', onReadUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('admin-etl-read-update', onReadUpdate);
    };
  }, [user?.role]);

  // Admin settings for ETL countdown — fetch on mount and poll so timer resets after ETL runs
  const fetchAdminSettings = React.useCallback(() => {
    const token = sessionStorage.getItem('ucu_session_token');
    if (!token) return Promise.resolve();
    return axios
      .get('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setAdminSettings(res.data?.settings ?? {}))
      .catch(() => setAdminSettings({}));
  }, []);

  useEffect(() => {
    const role = (user?.role || '').toString().toLowerCase();
    if (role !== 'sysadmin') {
      setAdminSettings({});
      setEtlCountdownSec(null);
      return;
    }
    let cancelled = false;
    fetchAdminSettings().then(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [user?.role, fetchAdminSettings]);

  // Poll admin settings when auto ETL is on so sidebar countdown resets after each run (no page refresh)
  useEffect(() => {
    const role = (user?.role || '').toString().toLowerCase();
    if (role !== 'sysadmin' || !adminSettings.etl_auto_enabled) return;
    const interval = setInterval(fetchAdminSettings, 15000);
    return () => clearInterval(interval);
  }, [user?.role, adminSettings.etl_auto_enabled, fetchAdminSettings]);

  useEffect(() => {
    if (!adminSettings.etl_auto_enabled) {
      setEtlCountdownSec(null);
      return;
    }
    const intervalMinutes = Number(adminSettings.etl_auto_interval_minutes) || 60;
    const intervalSec = Math.max(60, Math.round(intervalMinutes * 60));
    const lastRun = adminSettings.last_etl_auto_run;
    const nowSec = Date.now() / 1000;
    const nextRunSec = lastRun != null ? lastRun + intervalSec : nowSec + intervalSec;
    const tick = () => {
      const now = Date.now() / 1000;
      setEtlCountdownSec(Math.max(0, Math.floor(nextRunSec - now)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [adminSettings.etl_auto_enabled, adminSettings.etl_auto_interval_minutes, adminSettings.last_etl_auto_run]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = getNavItems();
  const currentPath = location.pathname;
  const role = (user?.role || '').toString().toLowerCase();
  const avatarInitials = React.useMemo(() => {
    const first = (user?.first_name || '').toString();
    const last = (user?.last_name || '').toString();
    const base =
      [first, last]
        .filter(Boolean)
        .map((n) => n[0])
        .join('') ||
      (user?.username?.[0] || user?.access_number?.[0] || '?');
    return base.toUpperCase().slice(0, 2);
  }, [user?.first_name, user?.last_name, user?.username, user?.access_number]);
  const profilePath =
    role === 'student'
      ? '/student/profile'
      : role === 'staff'
        ? '/staff/profile'
        : role === 'hod'
          ? '/hod/profile'
          : role === 'dean'
            ? '/dean/profile'
            : role === 'senate'
              ? '/senate/profile'
              : role === 'analyst'
                ? '/analyst/profile'
                : role === 'sysadmin'
                  ? '/admin/profile'
                  : role === 'hr'
                    ? '/hr/profile'
                    : role === 'finance'
                      ? '/finance/profile'
                      : '/profile';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 80 }}
        className="bg-card/80 backdrop-blur-xl border-r border-border hidden md:flex md:flex-col shadow-xl"
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <AnimatePresence mode="wait">
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h1 className="text-xl font-semibold text-primary">
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
                className="ml-auto h-9 w-9 hover:bg-muted rounded-lg"
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
              const badgeCount = item.path === '/admin/etl-notifications' ? etlRunCount : null;
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
                        : "hover:bg-muted hover:text-foreground text-foreground",
                      !sidebarOpen && "justify-center px-0"
                    )}
                    onClick={() => navigate(item.path)}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <span className="relative flex-shrink-0">
                      <Icon className="h-5 w-5" />
                      {sidebarOpen && badgeCount != null && badgeCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </span>
                    {sidebarOpen && (
                      <span className="flex items-center gap-2 truncate">
                        <span className="truncate">{item.label}</span>
                        {badgeCount != null && badgeCount > 0 && (
                          <Badge variant="secondary" className="shrink-0 h-5 min-w-[1.25rem] px-1 text-[10px] font-semibold">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </Badge>
                        )}
                      </span>
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </nav>

          {/* ETL countdown - admin only, in sidebar; updates every second, no refresh needed.
              Hidden on ETL Jobs page since that page already focuses on ETL timing. */}
          {role === 'sysadmin' &&
            adminSettings.etl_auto_enabled &&
            etlCountdownSec != null &&
            sidebarOpen &&
            !currentPath.startsWith('/admin/etl') && (
              <div className="px-3 pb-2">
                <div className="rounded-lg border border-border bg-muted/50 px-2 py-2">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Next ETL run</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400" title="Updates in real time">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      Live
                    </span>
                  </div>
                  <CountdownTimer seconds={etlCountdownSec} compact size="sm" />
                </div>
              </div>
            )}

          {/* User Section */}
          <div className="p-4 border-t border-border bg-muted/30">
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => navigate(profilePath)}
                title="View profile"
                className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                  {profilePhotoUrl && <AvatarImage src={profilePhotoUrl} alt="" className="object-cover" />}
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                    {avatarInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {user?.role}
                  </Badge>
                </motion.div>
              )}
            </div>
            {sidebarOpen && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 h-9 font-medium rounded-lg"
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
              className="fixed left-0 top-0 h-full bg-card/95 backdrop-blur-xl border-r border-border z-50 w-64 md:hidden shadow-2xl"
            >
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-semibold text-primary">
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
                  <div className="mb-3 sm:hidden">
                    <ThemeSwitcher />
                  </div>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPath === item.path;
                    const badgeCount = item.path === '/admin/etl-notifications' ? etlRunCount : null;
                    return (
                      <Button
                        key={item.path}
                        variant={isActive ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-3 h-11 font-medium",
                          isActive && "bg-primary text-primary-foreground shadow-lg"
                        )}
                        onClick={() => {
                          navigate(item.path);
                          setMobileMenuOpen(false);
                        }}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="flex items-center gap-2">
                          {item.label}
                          {badgeCount != null && badgeCount > 0 && (
                            <Badge variant="secondary" className="h-5 min-w-[1.25rem] px-1 text-[10px] font-semibold">
                              {badgeCount > 99 ? '99+' : badgeCount}
                            </Badge>
                          )}
                        </span>
                      </Button>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      type="button"
                      className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate(profilePath);
                      }}
                      title="View profile"
                    >
                      <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                        {profilePhotoUrl && <AvatarImage src={profilePhotoUrl} alt="" className="object-cover" />}
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                          {user?.first_name?.[0]}{user?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <Badge variant="secondary" className="text-xs mt-1">
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

      {/* ── Idle Session Warning Banner ──────────────────────────────── */}
      {sessionWarning && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-4 bg-amber-500 text-white px-5 py-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            Your session will expire in <strong>5 minutes</strong> due to inactivity.
          </div>
          <button
            onClick={dismissWarning}
            className="shrink-0 rounded-md bg-white/20 hover:bg-white/30 px-4 py-1.5 text-sm font-semibold transition-colors"
          >
            Stay Logged In
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-card/80 backdrop-blur-xl border-b border-border px-4 md:px-6 py-4 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-10 w-10 hover:bg-muted rounded-lg"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground truncate">
                {navItems.find(item => item.path === currentPath)?.label || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <ThemeSwitcher className="hidden sm:block" />
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-foreground">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(profilePath)}
                title="View profile"
                className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Avatar className="h-10 w-10 ring-2 ring-primary/30">
                  {profilePhotoUrl && <AvatarImage src={profilePhotoUrl} alt="" className="object-cover" />}
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content - responsive padding, no overflow-x; compact density */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/30">
          <div className="w-full max-w-7xl mx-auto px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-6 lg:py-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default LayoutModern;
