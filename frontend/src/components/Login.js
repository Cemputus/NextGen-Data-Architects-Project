/**
 * Modern Login Page - NextGen Data Architects Style
 * Clean, professional login interface with impressive animations
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, User, Loader2, Sparkles } from 'lucide-react';
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
  const [focused, setFocused] = useState({ username: false, password: false });
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
      // Check if backend is reachable (use no-auth endpoint to avoid 401/422 noise)
      try {
        await axios.get('/api/user-mgmt/ping', { timeout: 3000 });
      } catch (networkErr) {
        if (networkErr.code === 'ECONNABORTED' || networkErr.message?.includes('timeout')) {
          setError('Network timeout: Backend server is not responding. Please ensure the backend is running on http://localhost:5000');
          setLoading(false);
          return;
        }
        if (networkErr.message?.includes('Network Error') || networkErr.code === 'ERR_NETWORK') {
          setError('Network error: Cannot connect to backend server. Please ensure the backend is running on http://localhost:5000');
          setLoading(false);
          return;
        }
      }

      const result = await login(username.trim(), password);
      
      if (result.success && result.user) {
        const role = result.user?.role;
        console.log('Login successful, role:', role, 'User:', result.user);
        
        const routes = {
          senate: '/senate/dashboard',
          sysadmin: '/admin/dashboard',
          analyst: '/analyst/dashboard',
          student: '/student/dashboard',
          staff: '/staff/dashboard',
          dean: '/dean/dashboard',
          hod: '/hod/dashboard',
          hr: '/hr/dashboard',
          finance: '/finance/dashboard',
        };
        const roleKey = (role || '').toString().toLowerCase();
        const route = routes[roleKey] || rbac.getDefaultRoute(roleKey) || '/student/dashboard';
        console.log('Navigating to:', route);
        navigate(route);
      } else {
        let errorMsg = result.error || 'Invalid credentials. Please check your username and password.';
        if (errorMsg.toLowerCase().includes('invalid credentials')) {
          errorMsg += ' If you are an app user, ask an admin to reset your password in Admin → Users → Edit user.';
        }
        setError(errorMsg);
        console.error('Login failed:', result.error);
      }
    } catch (err) {
      console.error('Login exception:', err);
      if (err.message && (err.message.includes('Network') || err.message.includes('timeout'))) {
        setError('Network error: Cannot connect to backend server. Please ensure the backend is running on http://localhost:5000');
      } else {
        setError('An error occurred during login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          <p className="text-muted-foreground font-medium">Loading...</p>
        </motion.div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Theme switcher - top right for all users */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeSwitcher />
      </div>
      {/* Animated background elements - subtle in dark mode */}
      <div className="absolute inset-0 overflow-hidden opacity-30 dark:opacity-20">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo/Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-6 shadow-glow-lg relative"
            >
              <GraduationCap className="h-10 w-10 text-white relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-2xl blur-xl opacity-50 animate-pulse-glow"></div>
            </motion.div>
            <h1 className="text-4xl font-bold text-gradient-blue mb-3">
              UCU Management Information System
            </h1>
            <p className="text-muted-foreground font-medium text-lg">
              Uganda Christian University
            </p>
          </motion.div>

          {/* Login Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="shadow-2xl border border-border backdrop-blur-xl bg-card/95">
              <CardHeader className="space-y-1 pb-6">
                <CardTitle className="text-3xl text-center font-bold text-foreground">
                  Sign In
                </CardTitle>
                <CardDescription className="text-center text-base">
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium shadow-soft"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-semibold text-gray-700">
                      Username / Access Number
                    </Label>
                    <div className="relative group">
                      <User className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 transition-colors ${
                        focused.username ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <Input
                        id="username"
                        type="text"
                        placeholder="Enter username or access number"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onFocus={() => setFocused({ ...focused, username: true })}
                        onBlur={() => setFocused({ ...focused, username: false })}
                        className="pl-12 h-12 text-base border-2 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-soft hover:shadow-md"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                      Password
                    </Label>
                    <div className="relative group">
                      <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 transition-colors ${
                        focused.password ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocused({ ...focused, password: true })}
                        onBlur={() => setFocused({ ...focused, password: false })}
                        className="pl-12 h-12 text-base border-2 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-soft hover:shadow-md"
                        required
                      />
                    </div>
                  </div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-5 w-5" />
                          Sign In
                        </>
                      )}
                    </Button>
                  </motion.div>

                  <div className="text-center text-sm text-gray-600 pt-4 border-t border-gray-200">
                    <p className="font-medium">
                      For students: Use Access Number and password format:{' '}
                      <code className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-mono text-xs border border-blue-200">
                        AccessNumber@ucu
                      </code>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Staff/Admin: Use username and password (e.g., admin/admin123)
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-8 text-sm text-gray-600 font-medium"
          >
            <p>&copy; {new Date().getFullYear()} NextGen Data Architects. All rights reserved.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
