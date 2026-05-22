'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Video, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { login, signup } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'signup'
  
  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Status states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim() || !password.trim()) {
      return setError('Please fill in all required fields');
    }
    if (activeTab === 'signup' && !username.trim()) {
      return setError('Please enter a display name/username');
    }

    setLoading(true);
    try {
      if (activeTab === 'login') {
        const res = await login({ email: email.trim(), password });
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('userName', res.data.username);
        localStorage.removeItem('participantId');
        localStorage.removeItem('participantMeetingId');
        localStorage.removeItem('isHost');
        router.push('/');
      } else {
        await signup({ 
          email: email.trim(), 
          username: username.trim(), 
          password 
        });
        // On successful signup, automatically log them in
        const res = await login({ email: email.trim(), password });
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('userName', res.data.username);
        localStorage.removeItem('participantId');
        localStorage.removeItem('participantMeetingId');
        localStorage.removeItem('isHost');
        router.push('/');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputContainerStyle = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  };

  const iconStyle = {
    position: 'absolute',
    left: '14px',
    color: '#9ca3af',
  };

  const inputStyle = {
    width: '100%',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px 16px 12px 42px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
    background: '#fafafa',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea22, #764ba222)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(11, 92, 255, 0.07) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '40px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
              borderRadius: '12px',
              padding: '10px',
              boxShadow: '0 4px 12px rgba(11, 92, 255, 0.3)',
            }}
          >
            <Video size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              {activeTab === 'login' ? 'Welcome Back' : 'Get Started'}
            </h1>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '2px' }}>
              {activeTab === 'login' ? 'Sign in to access your meetings' : 'Create an account to save meetings'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            background: '#f3f4f6',
            padding: '4px',
            borderRadius: '10px',
            margin: '24px 0',
          }}
        >
          <button
            onClick={() => {
              setActiveTab('login');
              setError('');
            }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'login' ? '#ffffff' : 'transparent',
              color: activeTab === 'login' ? '#111827' : '#6b7280',
              boxShadow: activeTab === 'login' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            Log In
          </button>
          <button
            onClick={() => {
              setActiveTab('signup');
              setError('');
            }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'signup' ? '#ffffff' : 'transparent',
              color: activeTab === 'signup' ? '#111827' : '#6b7280',
              boxShadow: activeTab === 'signup' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {activeTab === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Username / Display Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={inputContainerStyle}>
                <User size={16} style={iconStyle} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Girish Garg"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0B5CFF';
                    e.target.style.boxShadow = '0 0 0 3px rgba(11,92,255,0.1)';
                    e.target.style.background = '#fff';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={inputContainerStyle}>
              <Mail size={16} style={iconStyle} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0B5CFF';
                  e.target.style.boxShadow = '0 0 0 3px rgba(11,92,255,0.1)';
                  e.target.style.background = '#fff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Password <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={inputContainerStyle}>
              <Lock size={16} style={iconStyle} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0B5CFF';
                  e.target.style.boxShadow = '0 0 0 3px rgba(11,92,255,0.1)';
                  e.target.style.background = '#fff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#dc2626',
                fontSize: '13px',
                marginTop: '4px',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => router.push('/')}
              style={{
                flex: 1,
                padding: '12px',
                border: '1.5px solid #e5e7eb',
                background: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <ArrowLeft size={15} />
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2,
                padding: '12px',
                background: loading
                  ? '#93c5fd'
                  : 'linear-gradient(135deg, #0B5CFF, #0047CC)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'opacity 0.15s',
                fontFamily: 'inherit',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(11,92,255,0.3)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  Please wait...
                </>
              ) : (
                activeTab === 'login' ? 'Log In' : 'Create Account'
              )}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
