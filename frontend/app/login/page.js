'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Video, Mail, Lock, User, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { login, signup } from '@/lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('login');

  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);

  const [errors,   setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [loading,  setLoading]  = useState(false);

  const isSignup = activeTab === 'signup';

  const switchTab = (tab) => {
    setActiveTab(tab);
    setErrors({});
    setApiError('');
  };

  const validate = () => {
    const e = {};
    if (isSignup) {
      if (!username.trim())          e.username = 'Username is required';
      else if (username.trim().length < 2) e.username = 'At least 2 characters required';
      else if (username.trim().length > 30) e.username = 'Maximum 30 characters';
      else if (!/^[a-zA-Z0-9 _-]+$/.test(username.trim())) e.username = 'Only letters, numbers, spaces, - and _';
    }

    if (!email.trim())               e.email = 'Email is required';
    else if (!EMAIL_RE.test(email))  e.email = 'Enter a valid email (e.g. you@example.com)';

    if (!password)                   e.password = 'Password is required';
    else if (isSignup) {
      if (password.length < 8)                        e.password = 'At least 8 characters required';
      else if (!/[A-Z]/.test(password))               e.password = 'Add at least one uppercase letter';
      else if (!/\d/.test(password))                  e.password = 'Add at least one number';
      else if (!/[^a-zA-Z0-9]/.test(password))        e.password = 'Add at least one special character (!@#$...)'
    }

    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      if (!isSignup) {
        const res = await login({ email: email.trim(), password });
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('userName', res.data.username);
        localStorage.removeItem('participantId');
        localStorage.removeItem('participantMeetingId');
        localStorage.removeItem('isHost');
        router.push('/');
      } else {
        await signup({ email: email.trim(), username: username.trim(), password });
        const res = await login({ email: email.trim(), password });
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('userName', res.data.username);
        localStorage.removeItem('participantId');
        localStorage.removeItem('participantMeetingId');
        localStorage.removeItem('isHost');
        router.push('/');
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setApiError(detail.map((d) => d.msg).join(' · '));
      } else {
        setApiError(detail || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: '100%',
    border: `1.5px solid ${errors[field] ? '#ef4444' : '#e5e7eb'}`,
    borderRadius: '10px',
    padding: '12px 40px 12px 42px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    background: '#fafafa',
    boxSizing: 'border-box',
  });

  const iconLeft  = { position: 'absolute', left: '14px', color: '#9ca3af', pointerEvents: 'none' };
  const iconRight = { position: 'absolute', right: '12px', color: '#9ca3af', cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex' };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea22, #764ba222)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle at 20% 50%, rgba(11,92,255,0.07) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(99,102,241,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ background: '#fff', borderRadius: '20px', padding: '40px 24px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ background: 'linear-gradient(135deg, #0B5CFF, #0047CC)', borderRadius: '12px', padding: '10px', boxShadow: '0 4px 12px rgba(11,92,255,0.3)' }}>
            <Video size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              {isSignup ? 'Get Started' : 'Welcome Back'}
            </h1>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '2px' }}>
              {isSignup ? 'Create an account to save meetings' : 'Sign in to access your meetings'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '10px', margin: '24px 0' }}>
          {['login', 'signup'].map((tab) => (
            <button key={tab} onClick={() => switchTab(tab)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s', fontFamily: 'inherit' }}>
              {tab === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Username */}
          {isSignup && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Username <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} style={iconLeft} />
                <input id="signup-username" type="text" value={username} placeholder="e.g. Girish Garg" style={inputStyle('username')} onChange={(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: '' })); }} />
              </div>
              {errors.username && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} />{errors.username}</p>}
            </div>
          )}

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Email <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={iconLeft} />
              <input id="auth-email" type="email" value={email} placeholder="you@example.com" style={inputStyle('email')} onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }} />
            </div>
            {errors.email && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} />{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Password <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={iconLeft} />
              <input id="auth-password" type={showPw ? 'text' : 'password'} value={password} placeholder="••••••••" style={inputStyle('password')} onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }} />
              <button type="button" style={iconRight} onClick={() => setShowPw((s) => !s)} tabIndex={-1}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} />{errors.password}</p>}

            {/* Password hint — signup only */}
            {isSignup && !errors.password && (
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                Use uppercase letters, numbers and special characters (!@#$...)
              </p>
            )}
          </div>

          {/* API error */}
          {apiError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', color: '#dc2626', fontSize: '13px' }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{apiError}</span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button id="auth-cancel-btn" type="button" onClick={() => router.push('/')} style={{ flex: 1, padding: '12px', border: '1.5px solid #e5e7eb', background: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <ArrowLeft size={15} /> Cancel
            </button>
            <button id="auth-submit-btn" type="submit" disabled={loading} style={{ flex: 2, padding: '12px', background: loading ? '#93c5fd' : 'linear-gradient(135deg, #0B5CFF, #0047CC)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 4px 12px rgba(11,92,255,0.3)' }}>
              {loading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Please wait...</> : (isSignup ? 'Create Account' : 'Log In')}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
