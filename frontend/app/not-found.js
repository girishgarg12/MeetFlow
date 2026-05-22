'use client';
import { useRouter } from 'next/navigation';
import { Video, HomeIcon } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8F9FA',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
          borderRadius: '20px',
          padding: '16px',
          marginBottom: '8px',
          boxShadow: '0 8px 24px rgba(11,92,255,0.3)',
        }}
      >
        <Video size={40} color="#fff" />
      </div>
      <h1 style={{ fontSize: '56px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>404</h1>
      <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#374151' }}>Page not found</h2>
      <p style={{ fontSize: '14px', color: '#9ca3af', maxWidth: '320px' }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <button
        onClick={() => router.push('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(11,92,255,0.3)',
          marginTop: '8px',
          fontFamily: 'inherit',
        }}
      >
        <HomeIcon size={16} />
        Back to Dashboard
      </button>
    </div>
  );
}
