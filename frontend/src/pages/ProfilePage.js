/**
 * Profile Page – modern UI for all users with profile picture upload
 */
import React, { useState, useEffect, useRef } from 'react';
import { User, Save, Camera, Loader2, Mail, Phone, Hash, BadgeCheck, ImagePlus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { cn } from '../lib/utils';

const getToken = () => localStorage.getItem('token');

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }
  const [avatarUrl, setAvatarUrl] = useState(null); // object URL from API or null
  const [previewUrl, setPreviewUrl] = useState(null); // data URL from file picker
  const [photoFile, setPhotoFile] = useState(null); // selected File for upload
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Load full profile (including profile_picture_url) on mount
  useEffect(() => {
    const token = getToken();
    if (!token || !user?.id) return;
    axios
      .get('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const data = res.data;
        setUser({ ...user, ...data });
        const first = data.first_name ?? (data.full_name?.split(' ')[0]) ?? '';
        const last = data.last_name ?? (data.full_name?.split(' ').slice(1).join(' ')) ?? '';
        setProfile({
          first_name: first,
          last_name: last,
          email: data.email ?? '',
          phone: data.phone ?? '',
        });
      })
      .catch(() => {});
  }, []);

  // Load profile photo from API when user has profile_picture_url
  useEffect(() => {
    if (!user?.profile_picture_url || !getToken()) {
      setAvatarUrl(null);
      return;
    }
    let objectUrl = null;
    const apiBase = process.env.REACT_APP_API_URL || '';
    const url = apiBase ? `${apiBase}/api/auth/profile/photo` : '/api/auth/profile/photo';
    axios
      .get(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
        responseType: 'blob',
      })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setAvatarUrl(objectUrl);
      })
      .catch(() => setAvatarUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.profile_picture_url]);

  // Sync profile state when user changes
  useEffect(() => {
    setProfile({
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    });
  }, [user?.first_name, user?.last_name, user?.email, user?.phone]);

  // Attach stream to video when camera modal opens
  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraOpen]);

  const update = (key, value) => {
    setProfile((p) => ({ ...p, [key]: value }));
    setMessage(null);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPhotoFile(file);
    setMessage(null);
  };

  const handleRemovePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setMessage(null);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCameraError(null);
  };

  const handleOpenCamera = async () => {
    setCameraError(null);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setCameraError(err.name === 'NotAllowedError' ? 'Camera access was denied.' : 'Could not open camera.');
      streamRef.current = null;
    }
  };

  const handleCapturePhoto = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopCamera();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPhotoFile(new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' }));
        setMessage(null);
      },
      'image/jpeg',
      0.9
    );
  };

  const handleDeletePicture = async () => {
    setDeletingPhoto(true);
    setMessage(null);
    try {
      const res = await axios.put(
        '/api/auth/profile',
        { ...profile, remove_profile_photo: true },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setUser(res.data.user);
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
      setAvatarUrl(null);
      setPreviewUrl(null);
      setPhotoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      setMessage({ type: 'success', text: 'Profile picture removed.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to remove picture.',
      });
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = { ...profile };
      if (photoFile) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(photoFile);
        });
        payload.profile_picture = base64;
      }
      const res = await axios.put('/api/auth/profile', payload, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setUser(res.data.user);
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
      setPhotoFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAvatarUrl(null);
      if (res.data.user?.profile_picture_url) {
        const url = process.env.REACT_APP_API_URL
          ? `${process.env.REACT_APP_API_URL}/api/auth/profile/photo`
          : '/api/auth/profile/photo';
        const blobRes = await axios.get(url, {
          headers: { Authorization: `Bearer ${getToken()}` },
          responseType: 'blob',
        });
        setAvatarUrl(URL.createObjectURL(blobRes.data));
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to update profile.',
      });
    } finally {
      setLoading(false);
    }
  };

  const displayAvatarUrl = previewUrl || avatarUrl;
  const initials = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || (user?.username?.[0] ?? '?');

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Camera capture modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-card rounded-2xl shadow-2xl overflow-hidden max-w-lg w-full">
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Take profile photo</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Position your face in the frame, then click Capture.
              </p>
            </div>
            <div className="relative bg-black aspect-square max-h-[60vh] flex items-center justify-center">
              {cameraError ? (
                <div className="p-6 text-center text-destructive">
                  <p className="font-medium">{cameraError}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Allow camera access in your browser settings and try again.
                  </p>
                  <Button type="button" variant="outline" className="mt-4" onClick={stopCamera}>
                    Close
                  </Button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
              )}
            </div>
            {!cameraError && (
              <div className="p-4 flex gap-3 justify-end border-t border-border">
                <Button type="button" variant="outline" onClick={stopCamera}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleCapturePhoto} className="gap-2">
                  <Camera className="h-4 w-4" />
                  Capture
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account and profile picture</p>
      </div>

      {/* Profile card */}
      <Card className="overflow-hidden">
        {/* Hero strip with avatar */}
        <div className="h-28 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-b border-border" />
        <CardHeader className="relative -mt-16 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="relative group">
              <Avatar className="h-28 w-28 rounded-2xl border-4 border-card shadow-xl bg-muted">
                {displayAvatarUrl ? (
                  <AvatarImage src={displayAvatarUrl} alt="Profile" className="object-cover" />
                ) : null}
                <AvatarFallback className="rounded-2xl text-3xl font-semibold bg-primary/20 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="rounded-full h-11 w-11"
                  onClick={() => handleOpenCamera()}
                  title="Take photo"
                >
                  <Camera className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="rounded-full h-11 w-11"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload from device"
                >
                  <ImagePlus className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-xl font-bold text-foreground">
                {user?.first_name} {user?.last_name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <BadgeCheck className="h-4 w-4 text-primary" />
                <span className="capitalize font-medium">{user?.role}</span>
                {(user?.access_number || user?.username) && (
                  <span className="text-muted-foreground/80">
                    · {user?.access_number || user?.username}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenCamera()}
                  className="gap-1.5"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Take photo
                </Button>
                {(previewUrl || photoFile) && (
                  <>
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto}>
                      Remove
                    </Button>
                  </>
                )}
                {(avatarUrl || user?.profile_picture_url) && !previewUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeletePicture}
                    disabled={deletingPhoto}
                    className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {deletingPhoto ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete picture
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {message && (
            <div
              className={cn(
                'rounded-lg px-4 py-3 text-sm',
                message.type === 'success'
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              )}
            >
              {message.text}
            </div>
          )}

          {/* Read-only info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
              <Hash className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Access / Username</p>
                <p className="font-semibold text-foreground">
                  {user?.access_number || user?.username || '—'}
                </p>
              </div>
            </div>
            {user?.reg_number && (
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Registration number</p>
                  <p className="font-semibold text-foreground">{user?.reg_number}</p>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <CardTitle className="text-lg">Edit details</CardTitle>
            <CardDescription>Update your name and contact information.</CardDescription>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="first_name"
                    value={profile.first_name}
                    onChange={(e) => update('first_name', e.target.value)}
                    className="pl-10"
                    placeholder="First name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="last_name"
                    value={profile.last_name}
                    onChange={(e) => update('last_name', e.target.value)}
                    className="pl-10"
                    placeholder="Last name"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="pl-10"
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  className="pl-10"
                  placeholder="+256 ..."
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
