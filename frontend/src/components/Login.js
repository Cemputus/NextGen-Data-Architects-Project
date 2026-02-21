/**
 * Modern Login Page — Split layout, strong branding, refined form
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, User, Loader2, ArrowRight, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { useAuth } from '../context/AuthContext';
import { rbac } from '../utils/rbac';
import { ThemeSwitcher } from './ThemeSwitcher';
import axios from 'axios';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const role = (JSON.parse(localStorage.getItem('user'))?.role || '').toString().toLowerCase();
      const route = rbac.getDefaultRoute(role) || '/student/dashboard';
      navigate(route);
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      try {
        await axios.get('/api/user-mgmt/ping', { timeout: 3000 });
      } catch (networkErr) {
        if (networkErr.code === 'ECONNABORTED' || networkErr.message?.includes('timeout')) {
          setError('Network timeout. Ensure the backend is running on http://localhost:5000');
          setLoading(false);
          return;
        }
        if (networkErr.message?.includes('Network Error') || networkErr.code === 'ERR_NETWORK') {
          setError('Cannot connect to server. Ensure the backend is running on http://localhost:5000');
          setLoading(false);
          return;
        }
      }
      const result = await login(username.trim(), password);
      if (result.success && result.user) {
        const role = result.user?.role;
        const routes = {
          senate: '/senate/dashboard', sysadmin: '/admin/dashboard', analyst: '/analyst/dashboard',
          student: '/student/dashboard', staff: '/staff/dashboard', dean: '/dean/dashboard',
          hod: '/hod/dashboard', hr: '/hr/dashboard', finance: '/finance/dashboard',
        };
        const roleKey = (role || '').toString().toLowerCase();
        navigate(routes[roleKey] || rbac.getDefaultRoute(roleKey) || '/student/dashboard');
      } else {
        let errorMsg = result.error || 'Invalid credentials. Please check your username and password.';
        if (errorMsg.toLowerCase().includes('invalid credentials')) {
          errorMsg += ' App users: ask an admin to reset password in Admin → Users.';
        }
        setError(errorMsg);
      }
    } catch (err) {
      setError(err?.message?.includes('Network') ? 'Cannot connect to server.' : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary/20" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </motion.div>
      </div>
    );
  }

  if (isAuthenticated) return null;

  const formVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.05, duration: 0.35 },
    }),
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background overflow-hidden">
      {/* Theme switcher */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeSwitcher />
      </div>

      {/* Left: Brand panel — animated gradient + floating orbs */}
      <div className="hidden md:flex md:w-[48%] lg:w-[52%] flex-col justify-between p-10 lg:p-14 text-white relative overflow-hidden login-gradient-bg">
        {/* Floating orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="absolute top-[15%] left-[10%] w-64 h-64 rounded-full bg-white/10 blur-3xl login-float" />
          <div className="absolute bottom-[25%] right-[5%] w-48 h-48 rounded-full bg-cyan-300/20 blur-3xl login-float login-float-2" />
          <div className="absolute top-[55%] left-[30%] w-40 h-40 rounded-full bg-blue-200/15 blur-2xl login-float login-float-3" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(at_50%_0%,rgba(255,255,255,0.15),transparent_55%)]" aria-hidden />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/25 backdrop-blur-md border border-white/40 shadow-xl"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <GraduationCap className="h-9 w-9 text-white" aria-hidden />
          </motion.div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="relative space-y-5"
        >
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-white drop-shadow-md">
            NextGen MIS
          </h1>
          <p className="text-lg lg:text-xl text-blue-100/95 max-w-sm leading-relaxed">
            Uganda Christian University — analytics, predictions, and reporting in one place.
          </p>
          <div className="flex items-center gap-3 text-blue-100/90 text-sm bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 w-fit border border-white/20">
            <Shield className="h-5 w-5 shrink-0 text-emerald-200" aria-hidden />
            <span>Secure sign-in. Your data stays protected.</span>
          </div>
        </motion.div>
        <div className="relative text-blue-100/70 text-xs">
          &copy; {new Date().getFullYear()} NextGen Data Architects
        </div>
      </div>

      {/* Right: Form panel — subtle gradient + dot pattern */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 md:p-10 relative bg-gradient-to-br from-primary/5 via-muted/20 to-primary/5 dark:from-background dark:via-muted/10 dark:to-background">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] bg-[size:24px_24px]" aria-hidden />
        <div className="w-full max-w-[400px] relative z-10">
          {/* Mobile branding */}
          <div className="md:hidden text-center mb-8">
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-lg shadow-primary/25 mb-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <GraduationCap className="h-9 w-9" aria-hidden />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground">NextGen MIS</h1>
            <p className="text-sm text-muted-foreground mt-1">Uganda Christian University</p>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            className="space-y-6"
          >
            <motion.div variants={formVariants} custom={0}>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in to your account to continue
              </p>
            </motion.div>

            <motion.div
              variants={formVariants}
              custom={4}
              className="focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2 rounded-2xl transition-shadow duration-300"
            >
            <Card className="border border-border shadow-xl shadow-black/5 dark:shadow-none bg-card/98 backdrop-blur-sm overflow-hidden hover:shadow-2xl hover:shadow-primary/5 transition-shadow duration-300">
              <CardContent className="p-6 sm:p-8 pt-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      id="login-error"
                      role="alert"
                      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2"
                    >
                      <span className="shrink-0 mt-0.5">!</span>
                      <span>{error}</span>
                    </motion.div>
                  )}

                  <motion.div variants={formVariants} custom={1} className="space-y-2">
                    <Label htmlFor="username" className="text-xs font-medium text-muted-foreground">
                      Username or Access Number
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                      <Input
                        id="username"
                        type="text"
                        placeholder="e.g. j.doe or AccessNumber"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10 h-10 rounded-xl border-input bg-background focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all duration-200"
                        required
                        autoFocus
                        autoComplete="username"
                        aria-describedby={error ? 'login-error' : undefined}
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={formVariants} custom={2} className="space-y-2">
                    <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 h-10 rounded-xl border-input bg-background focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all duration-200"
                        required
                        autoComplete="current-password"
                        aria-describedby={error ? 'login-error' : undefined}
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={formVariants} custom={3}>
                    <motion.div whileHover={loading ? {} : { scale: 1.02 }} whileTap={loading ? {} : { scale: 0.98 }}>
                      <Button
                        type="submit"
                        className="w-full h-12 rounded-xl font-semibold text-base bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-600/95 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 gap-2 border-0"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Signing in...
                          </>
                        ) : (
                          <>
                            Sign in
                            <ArrowRight className="h-4 w-4" aria-hidden />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.div>
                </form>

                <div className="mt-6 pt-5 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground/80">Students:</strong> Use Access Number and password{' '}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">AccessNumber@ucu</code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    <strong className="text-foreground/80">Staff/Admin:</strong> Use your username and password
                  </p>
                </div>
              </CardContent>
            </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
