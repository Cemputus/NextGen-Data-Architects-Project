/**
 * Returns an object URL for the current user's profile photo if available.
 * Used by Layout and ProfilePage to display avatar.
 */
import { useState, useEffect } from 'react';
import axios from 'axios';

const getToken = () => localStorage.getItem('token');

export function useProfilePhoto(profilePictureUrl) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!profilePictureUrl || !getToken()) {
      setUrl(null);
      return;
    }
    let objectUrl = null;
    const apiBase = process.env.REACT_APP_API_URL || '';
    const endpoint = apiBase ? `${apiBase}/api/auth/profile/photo` : '/api/auth/profile/photo';
    axios
      .get(endpoint, {
        headers: { Authorization: `Bearer ${getToken()}` },
        responseType: 'blob',
      })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profilePictureUrl]);

  return url;
}
