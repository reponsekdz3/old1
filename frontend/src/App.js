import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './services/store';
import api from './services/api';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage';
import StarredMessages from './pages/StarredMessages';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import AccountVerificationPage from './pages/AccountVerificationPage';
import { Toaster } from 'react-hot-toast';
import { registerServiceWorker, subscribeToPush, listenForPushMessages } from './services/pushService';
import './App.css';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function needsConfirmation(user) {
  if (!user) return false;
  if (user.account_confirmed_at) return false;
  const createdAt = new Date(user.created_at).getTime();
  return Date.now() - createdAt >= TWO_DAYS_MS;
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (needsConfirmation(user)) return <Navigate to="/verify-account" replace />;
  return children;
}

function App() {
  const { user, setUser, setLoading, isAuthenticated } = useAuthStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const response = await api.get('/auth/user');
          setUser(response.data);
          // Initialize push notifications after user is loaded
          registerServiceWorker().then(() => {
            subscribeToPush().catch(() => {});
          }).catch(() => {});
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } finally {
        setLoading(false);
        setInitializing(false);
      }
    };
    initializeApp();

    // Listen for push notification click events from service worker
    listenForPushMessages((msg) => {
      if (msg?.url) window.location.href = msg.url;
    });
  }, [setUser, setLoading]);

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f0f2f5]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading Bitese...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { borderRadius: '12px', fontFamily: 'inherit', fontSize: '13px' },
          success: { iconTheme: { primary: '#25D366', secondary: '#fff' } },
        }}
      />
      <Router>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/signup" element={isAuthenticated ? <Navigate to="/" /> : <SignupPage />} />

          {/* Account confirmation gate (after 2 days) */}
          <Route path="/verify-account"
            element={isAuthenticated ? <AccountVerificationPage /> : <Navigate to="/login" />} />

          <Route path="/" element={
            <ProtectedRoute user={user}><ChatPage /></ProtectedRoute>
          } />
          <Route path="/starred" element={
            <ProtectedRoute user={user}><StarredMessages /></ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute user={user}><SettingsPage /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute user={user}><AdminPage /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
