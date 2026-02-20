import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUserState] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state

  // Setup axios interceptor for 401 errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - clear auth state
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUserState(null);
          setIsAuthenticated(false);
          delete axios.defaults.headers.common['Authorization'];
          
          // Only redirect if not already on login page
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Restore authentication from localStorage on mount
  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken && storedUser) {
          // Set token and user immediately for optimistic UI
          setToken(storedToken);
          setUserState(JSON.parse(storedUser));
          setIsAuthenticated(true);
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Optionally validate token with a lightweight API call
          // This ensures the token is still valid
          // Use a timeout to avoid blocking if API is slow
          try {
            await Promise.race([
              axios.get('/api/dashboard/stats'),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 3000)
              )
            ]);
            // Token is valid, keep authentication state
          } catch (error) {
            // Token is invalid or API unavailable
            if (error.response?.status === 401) {
              // Token expired or invalid - clear auth
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              setToken(null);
              setUserState(null);
              setIsAuthenticated(false);
              delete axios.defaults.headers.common['Authorization'];
            }
            // If it's a timeout or network error, keep the token
            // It will be validated on the next API call
          }
        }
      } catch (error) {
        console.error('Error restoring auth:', error);
        // Clear invalid auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUserState(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    restoreAuth();
  }, []);

  const login = async (identifier, password) => {
    try {
      const response = await axios.post('/api/auth/login', { 
        identifier,  // Can be Access Number, username, or email
        password 
      }, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const { access_token, refresh_token, user, role } = response.data;
      
      // Ensure user object has role (normalized to lowercase so role-based UI always works)
      const rawRole = (role || user?.role || 'student').toString().toLowerCase();
      const userWithRole = {
        ...user,
        role: rawRole
      };
      
      setToken(access_token);
      setUserState(userWithRole);
      setIsAuthenticated(true);
      
      localStorage.setItem('token', access_token);
      if (refresh_token) {
        localStorage.setItem('refresh_token', refresh_token);
      }
      localStorage.setItem('user', JSON.stringify(userWithRole));
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      return { success: true, user: userWithRole };
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed';
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage = 'Request timeout: Backend server is not responding. Please ensure the backend is running.';
      } else if (error.message && error.message.includes('Network Error')) {
        errorMessage = 'Network error: Cannot connect to backend server. Please ensure the backend is running on http://localhost:5000';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    setToken(null);
    setUserState(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  const setUser = (nextUser) => {
    setUserState(nextUser);
    if (nextUser) {
      localStorage.setItem('user', JSON.stringify(nextUser));
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, setUser, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};




