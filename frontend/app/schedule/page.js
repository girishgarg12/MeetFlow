'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ArrowLeft, CheckCircle, Loader2, Clock, AlignLeft, Type } from 'lucide-react';
import { createMeeting } from '@/lib/api';

export default function ScheduleMeeting() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    duration: 60,
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.time) {
      alert('Please fill in the title, date, and time.');
      return;
    }

    setLoading(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString();
      const activeName = (typeof window !== 'undefined' && localStorage.getItem('userName')) || 'Girish';
      await createMeeting({
        title: form.title.trim(),
        description: form.description.trim(),
        host_name: activeName,
        meeting_type: 'scheduled',
        scheduled_at: scheduledAt,
        duration: parseInt(form.duration, 10),
      });
      setSuccess(true);
      setTimeout(() => router.push('/'), 2000);
    } catch (err) {
      alert('Failed to schedule meeting. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    background: '#fafafa',
    color: '#111827',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  const focusHandlers = {
    onFocus: (e) => {
      e.target.style.borderColor = '#6366f1';
      e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
      e.target.style.background = '#fff';
    },
    onBlur: (e) => {
      e.target.style.borderColor = '#e5e7eb';
      e.target.style.boxShadow = 'none';
    },
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #f5f3ff 0%, #F8F9FA 60%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '22px',
          width: '100%',
          maxWidth: '500px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
        className="p-6 sm:p-10"
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              borderRadius: '12px',
              padding: '10px',
              boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
            }}
          >
            <Calendar size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              Schedule a Meeting
            </h1>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '2px' }}>
              Plan ahead — set up your next meeting
            </p>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '24px 0' }} />

        {success ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle size={36} color="#10b981" />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Meeting Scheduled!
            </h2>
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>
              Redirecting you to the dashboard...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Title */}
            <div>
              <label
                htmlFor="sched-title"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                <Type size={13} />
                Meeting Title <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="sched-title"
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Team Weekly Sync"
                style={inputStyle}
                {...focusHandlers}
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="sched-description"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                <AlignLeft size={13} />
                Description{' '}
                <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="sched-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Meeting agenda or discussion points..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                {...focusHandlers}
              />
            </div>

            {/* Date + Time Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  htmlFor="sched-date"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  <Calendar size={13} />
                  Date <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="sched-date"
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  style={inputStyle}
                  {...focusHandlers}
                />
              </div>
              <div>
                <label
                  htmlFor="sched-time"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  <Clock size={13} />
                  Time <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="sched-time"
                  type="time"
                  name="time"
                  value={form.time}
                  onChange={handleChange}
                  style={inputStyle}
                  {...focusHandlers}
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label
                htmlFor="sched-duration"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                <Clock size={13} />
                Duration
              </label>
              <select
                id="sched-duration"
                name="duration"
                value={form.duration}
                onChange={handleChange}
                style={{ ...inputStyle, cursor: 'pointer' }}
                {...focusHandlers}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
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
                  fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <ArrowLeft size={15} />
                Cancel
              </button>
              <button
                id="schedule-submit-btn"
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: loading
                    ? '#c4b5fd'
                    : 'linear-gradient(135deg, #6366f1, #4f46e5)',
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
                  fontFamily: 'inherit',
                  boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.3)',
                  transition: 'opacity 0.15s',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar size={15} />
                    Schedule Meeting
                  </>
                )}
              </button>
            </div>
          </form>
        )}
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
