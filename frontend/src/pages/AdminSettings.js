/**
 * Admin Settings Page - System settings (enhanced)
 * Sections: General, Security & sessions, Notifications, Appearance, About
 */
import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Loader2,
  Shield,
  Bell,
  Palette,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select } from '../components/ui/select';
import { useTheme } from '../context/ThemeContext';

const defaultSettings = {
  systemName: 'NextGen Data Architects',
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  supportEmail: '',
  sessionTimeout: 24,
  sessionTimeoutUnit: 'hours',
  maxLoginAttempts: 5,
  enableNotifications: true,
  emailOnEtlFailure: true,
  dailyDigest: false,
  theme: 'system',
  compactSidebar: false,
};

const AdminSettings = () => {
  const { theme: liveTheme, setTheme: setLiveTheme } = useTheme();
  const [settings, setSettings] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // Optional: load saved settings from API
    const loadSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSettings((prev) => ({ ...defaultSettings, ...prev, ...data.settings }));
        }
      } catch {
        // Use defaults if no backend
      }
    };
    loadSettings();
  }, []);

  const update = (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setDirty(true);
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully.' });
        setDirty(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage({
          type: 'error',
          text: err.error || `Save failed (${res.status}). Settings applied locally.`,
        });
      }
    } catch (e) {
      setMessage({
        type: 'error',
        text: 'Could not reach server. Changes are applied locally only.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure system preferences, security, and notifications
          </p>
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <span
              className={`flex items-center gap-2 text-sm ${
                message.type === 'success'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {message.text}
            </span>
          )}
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="about" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>Application name, API endpoint, and support contact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="systemName">System name</Label>
                <Input
                  id="systemName"
                  value={settings.systemName}
                  onChange={(e) => update('systemName', e.target.value)}
                  placeholder="NextGen Data Architects"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiUrl">API base URL</Label>
                <Input
                  id="apiUrl"
                  value={settings.apiUrl}
                  onChange={(e) => update('apiUrl', e.target.value)}
                  placeholder="http://localhost:5000"
                />
                <p className="text-xs text-muted-foreground">
                  Backend API URL used by the frontend. Change only if you use a different host or port.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support email (optional)</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => update('supportEmail', e.target.value)}
                  placeholder="support@example.com"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security & sessions</CardTitle>
              <CardDescription>Session timeout and login attempt limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session timeout</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sessionTimeout"
                      type="number"
                      min={1}
                      max={720}
                      value={settings.sessionTimeout}
                      onChange={(e) => update('sessionTimeout', parseInt(e.target.value, 10) || 24)}
                    />
                    <Select
                      value={settings.sessionTimeoutUnit}
                      onChange={(e) => update('sessionTimeoutUnit', e.target.value)}
                      className="w-28"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    After this period of inactivity, users are required to sign in again.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLoginAttempts">Max login attempts</Label>
                  <Input
                    id="maxLoginAttempts"
                    type="number"
                    min={3}
                    max={20}
                    value={settings.maxLoginAttempts}
                    onChange={(e) =>
                      update('maxLoginAttempts', parseInt(e.target.value, 10) || 5)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Lock account after this many failed attempts (if enforced by backend).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Email and in-app notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableNotifications}
                  onChange={(e) => update('enableNotifications', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">Enable in-app notifications</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailOnEtlFailure}
                  onChange={(e) => update('emailOnEtlFailure', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">Email on ETL failure</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.dailyDigest}
                  onChange={(e) => update('dailyDigest', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">Daily digest email</span>
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Theme and layout preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  id="theme"
                  value={liveTheme}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLiveTheme(v);
                    update('theme', v);
                  }}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Applies for all users via the theme switcher in the header. This choice updates your current session and is saved with settings.
                </p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.compactSidebar}
                  onChange={(e) => update('compactSidebar', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">Compact sidebar</span>
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About & environment</CardTitle>
              <CardDescription>Read-only system and environment information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium text-muted-foreground">API base URL (current):</span>{' '}
                  {process.env.REACT_APP_API_URL || settings.apiUrl || '—'}
                </p>
                <p>
                  <span className="font-medium text-muted-foreground">Environment:</span>{' '}
                  {process.env.NODE_ENV || 'development'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
