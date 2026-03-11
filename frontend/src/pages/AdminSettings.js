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
  Pencil,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select } from '../components/ui/select';
import { PageHeader, PageContent } from '../components/ui/page-header';
import { useTheme } from '../context/ThemeContext';
import adminUIState from '../utils/adminUIState';

const defaultAbout = {
  systemDescription: 'This platform is a data analytics and ETL management system. It supports data pipelines, warehouse integration, analyst dashboards, and administrative oversight—including ETL run history, notifications, audit logs, and user management.',
  teamIntro: 'Developed by the NextGen Data Architects team as part of their studies in Bachelor of Science in Data Science and Analytics at Uganda Christian University.',
  developers: [
    { name: 'Guloba Emmanuel Edube', githubHandle: 'Edube20Emmanuel' },
    { name: 'Emmanuel Nsubuga', githubHandle: 'Cemputus' },
    { name: 'Asingwiire Enoch', githubHandle: 'asingwiireenoch' },
  ],
};

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
  about: defaultAbout,
};

const AdminSettings = () => {
  const { theme: liveTheme, setTheme: setLiveTheme } = useTheme();
  const [settings, setSettings] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }
  const [dirty, setDirty] = useState(false);
  const [aboutEditMode, setAboutEditMode] = useState(false);
  const [editAbout, setEditAbout] = useState(null); // when editing, local copy of about
  const [savingAbout, setSavingAbout] = useState(false);
  const settingsUI = adminUIState.getSection('settings');
  const [activeTab, setActiveTabState] = useState(() => settingsUI.activeTab || 'general');
  const setActiveTab = (v) => {
    setActiveTabState(v);
    adminUIState.setSection('settings', { activeTab: v });
  };

  useEffect(() => {
    // Optional: load saved settings from API
    const loadSettings = async () => {
      try {
        const token = sessionStorage.getItem('ucu_session_token');
        if (!token) return;
        const res = await fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const loaded = data.settings || {};
          const about = loaded.about && typeof loaded.about === 'object'
            ? { ...defaultAbout, ...loaded.about, developers: (loaded.about.developers || defaultAbout.developers).slice(0, 10).map(d => ({ name: d?.name ?? '', githubHandle: d?.githubHandle ?? '' })) }
            : defaultAbout;
          setSettings((prev) => ({ ...defaultSettings, ...prev, ...loaded, about }));
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
      const token = sessionStorage.getItem('ucu_session_token');
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
    <PageContent>
      <PageHeader
        title="System Settings"
        description="Configure system preferences, security, and notifications"
        actions={
          <div className="flex items-center gap-3">
            {message && (
              <span
                className={`flex items-center gap-2 text-sm ${
                  message.type === 'success'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
                role={message.type === 'error' ? 'alert' : undefined}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {message.text}
              </span>
            )}
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4 mr-2" aria-hidden />
              )}
              Save settings
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <span className="text-sm font-medium">Enable in-app notifications</span>
              </label>
              <p className="text-xs text-muted-foreground ml-7">Show ETL run status and other alerts in the admin UI (e.g. on ETL Jobs page).</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailOnEtlFailure}
                  onChange={(e) => update('emailOnEtlFailure', e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <span className="text-sm font-medium">Email on ETL failure</span>
              </label>
              <p className="text-xs text-muted-foreground ml-7">Send an email to the Support email when automatic ETL fails. Set Support email in General and SMTP env vars on the server.</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.dailyDigest}
                  onChange={(e) => update('dailyDigest', e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <span className="text-sm font-medium">Daily digest email</span>
              </label>
              <p className="text-xs text-muted-foreground ml-7">Send a daily summary to the Support email. Requires Support email and SMTP configuration (SMTP_HOST, SMTP_PORT, etc.).</p>
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
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <span className="text-sm font-medium">Compact sidebar</span>
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>About & environment</CardTitle>
                <CardDescription>System information, team, and environment</CardDescription>
              </div>
              {!aboutEditMode ? (
                <Button variant="outline" size="sm" onClick={() => { setEditAbout({ ...(settings.about || defaultAbout) }); setAboutEditMode(true); }} className="shrink-0">
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setAboutEditMode(false); setEditAbout(null); }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingAbout}
                    onClick={async () => {
                      if (!editAbout) return;
                      setSavingAbout(true);
                      const nextSettings = { ...settings, about: editAbout };
                      setSettings(nextSettings);
                      setAboutEditMode(false);
                      setEditAbout(null);
                      try {
                        const token = localStorage.getItem('token');
                        const res = await fetch('/api/admin/settings', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ settings: nextSettings }),
                        });
                        if (res.ok) setMessage({ type: 'success', text: 'About content saved.' });
                        else setMessage({ type: 'error', text: 'Failed to save about content.' });
                      } catch {
                        setMessage({ type: 'error', text: 'Could not reach server.' });
                      } finally {
                        setSavingAbout(false);
                      }
                    }}
                  >
                    {savingAbout ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {aboutEditMode && editAbout ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="about-system">About the system</Label>
                    <textarea
                      id="about-system"
                      value={editAbout.systemDescription || ''}
                      onChange={(e) => setEditAbout((a) => ({ ...a, systemDescription: e.target.value }))}
                      rows={4}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="about-team">Team intro</Label>
                    <textarea
                      id="about-team"
                      value={editAbout.teamIntro || ''}
                      onChange={(e) => setEditAbout((a) => ({ ...a, teamIntro: e.target.value }))}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Developers (name — @handle)</Label>
                    <div className="space-y-2">
                      {(editAbout.developers || []).map((dev, i) => (
                        <div key={i} className="flex flex-wrap gap-2 items-center">
                          <Input
                            placeholder="Full name"
                            value={dev.name || ''}
                            onChange={(e) => {
                              const devs = [...(editAbout.developers || [])];
                              devs[i] = { ...devs[i], name: e.target.value };
                              setEditAbout((a) => ({ ...a, developers: devs }));
                            }}
                            className="flex-1 min-w-[140px]"
                          />
                          <Input
                            placeholder="@githubHandle"
                            value={dev.githubHandle || ''}
                            onChange={(e) => {
                              const devs = [...(editAbout.developers || [])];
                              devs[i] = { ...devs[i], githubHandle: e.target.value.replace(/^@/, '') };
                              setEditAbout((a) => ({ ...a, developers: devs }));
                            }}
                            className="w-40"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3 text-sm">
                    <div>
                      <h4 className="font-medium text-foreground mb-1">About the system</h4>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {(settings.about || defaultAbout).systemDescription}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Team</h4>
                      <p className="text-muted-foreground mb-2 whitespace-pre-wrap">
                        {(settings.about || defaultAbout).teamIntro}
                      </p>
                      <ul className="text-muted-foreground text-sm space-y-1 list-none">
                        {((settings.about || defaultAbout).developers || []).map((dev, i) => (
                          <li key={i}>
                            <a
                              href={dev.githubHandle ? `https://github.com/${dev.githubHandle.replace(/^@/, '')}` : undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {dev.name || '—'}
                            </a>
                            {dev.githubHandle ? ` — @${dev.githubHandle.replace(/^@/, '')}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
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
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContent>
  );
};
export default AdminSettings;
