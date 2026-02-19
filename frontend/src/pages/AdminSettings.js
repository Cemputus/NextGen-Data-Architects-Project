/**
 * Admin Settings Page - System settings
 */
import React, { useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    systemName: 'NextGen Data Architects',
    apiUrl: 'http://localhost:5000',
    sessionTimeout: 24,
    enableNotifications: true
  });

  const handleSave = () => {
    // TODO: Implement settings save
    console.log('Saving settings:', settings);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-muted-foreground">Configure system preferences and options</p>
        </div>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Basic system configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>System Name</Label>
            <Input
              value={settings.systemName}
              onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
            />
          </div>
          <div>
            <Label>API URL</Label>
            <Input
              value={settings.apiUrl}
              onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
            />
          </div>
          <div>
            <Label>Session Timeout (hours)</Label>
            <Input
              type="number"
              value={settings.sessionTimeout}
              onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;






