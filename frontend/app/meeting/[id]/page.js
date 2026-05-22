'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Mic, MicOff, Video, VideoOff, Phone,
  Users, MessageSquare, Shield, Copy, Check,
  Wifi, WifiOff, Loader2
} from 'lucide-react';
import { getMeeting, getParticipants, endMeeting, leaveMeeting } from '@/lib/api';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export default function MeetingRoom() {
  const router = useRouter();
  const { id } = useParams();

  // ─── STATE ────────────────────────────────────────────────
  const [meeting, setMeeting]                   = useState(null);
  const [participants, setParticipants]         = useState([]);
  const [isMuted, setIsMuted]                   = useState(false);
  const [isVideoOff, setIsVideoOff]             = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [copied, setCopied]                     = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | connected | error | disconnected
  const [cameraError, setCameraError]           = useState(false);
  const [initDone, setInitDone]                 = useState(false);

  const [userName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('userName') || 'Guest';
    return 'Guest';
  });
  const [isHost] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('isHost') === 'true';
    return false;
  });

  // ─── REFS ─────────────────────────────────────────────────
  const localVideoRef     = useRef(null);
  const localStream       = useRef(null);
  const wsRef             = useRef(null);
  const peersRef          = useRef({});
  // ICE candidates that arrive before remoteDescription is set are queued here
  const iceCandidateQueue = useRef({}); // { userName: [RTCIceCandidateInit, ...] }
  // Per-peer negotiation lock — prevents duplicate offer/answer while one is in flight
  const negotiatingRef    = useRef({}); // { userName: boolean }
  // Guards against React Strict Mode double-invoking the effect
  const initializedRef    = useRef(false);

  // ─── WEBRTC CONFIG ─────────────────────────────────────────
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // ─── 1. GET USER CAMERA ─────────────────────────────────────
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.warn('Camera/mic access denied:', err);
      setCameraError(true);
      return null;
    }
  }, []);

  // ─── 2. CREATE RTCPeerConnection ──────────────────────────
  const createPeerConnection = useCallback(
    (targetUser) => {
      // Close any existing connection cleanly
      if (peersRef.current[targetUser]) {
        peersRef.current[targetUser].close();
        delete peersRef.current[targetUser];
      }
      // Reset ICE queue for this peer
      iceCandidateQueue.current[targetUser] = [];
      negotiatingRef.current[targetUser] = false;

      const pc = new RTCPeerConnection(RTC_CONFIG);

      // Add local tracks
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStream.current);
        });
      }

      // On remote stream → attach to video element
      pc.ontrack = (event) => {
        const remoteVideo = document.getElementById(`video-${targetUser}`);
        if (remoteVideo && event.streams[0]) {
          remoteVideo.srcObject = event.streams[0];
        }
      };

      // Send ICE candidates via WebSocket
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate,
              target: targetUser,
              from: userName,
            })
          );
        }
      };

      peersRef.current[targetUser] = pc;
      return pc;
    },
    [userName] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── FLUSH QUEUED ICE CANDIDATES ─────────────────────────
  // Must be called after setRemoteDescription completes
  const flushIceCandidates = useCallback(async (targetUser) => {
    const pc = peersRef.current[targetUser];
    const queue = iceCandidateQueue.current[targetUser] || [];
    iceCandidateQueue.current[targetUser] = [];
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Flushing queued ICE candidate failed:', e);
      }
    }
  }, []);

  // ─── 3. WEBSOCKET + SIGNALING ────────────────────────────
  const connectWebSocket = useCallback(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/${id}/${encodeURIComponent(userName)}`);
    wsRef.current = ws;

    ws.onopen = () => setConnectionStatus('connected');

    ws.onmessage = async (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      // ── Someone new joined → we are the offerer ──
      if (message.type === 'user_joined' && message.user !== userName) {
        // Guard: skip if already negotiating with this user
        if (negotiatingRef.current[message.user]) return;
        negotiatingRef.current[message.user] = true;

        const pc = createPeerConnection(message.user);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: 'offer', offer, target: message.user, from: userName }));
        } catch (e) {
          console.error('Error creating offer:', e);
          negotiatingRef.current[message.user] = false;
        }
        setParticipants((prev) => {
          if (prev.find((p) => p.name === message.user)) return prev;
          return [...prev, { name: message.user, is_host: false }];
        });
      }

      // ── Received an offer → we are the answerer ──
      else if (message.type === 'offer' && message.target === userName) {
        const pc = createPeerConnection(message.from);
        try {
          // Only accept offer when in correct state
          if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-pranswer') {
            await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
            await flushIceCandidates(message.from); // apply any queued candidates
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', answer, target: message.from, from: userName }));
          }
        } catch (e) {
          console.error('Error handling offer:', e);
        }
        setParticipants((prev) => {
          if (prev.find((p) => p.name === message.from)) return prev;
          return [...prev, { name: message.from, is_host: false }];
        });
      }

      // ── Received an answer → complete the handshake ──
      else if (message.type === 'answer' && message.target === userName) {
        const pc = peersRef.current[message.from];
        // Only apply answer when we are waiting for one (have-local-offer state)
        if (pc && pc.signalingState === 'have-local-offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
            await flushIceCandidates(message.from); // apply any queued candidates
          } catch (e) {
            console.error('Error setting remote answer:', e);
          } finally {
            negotiatingRef.current[message.from] = false;
          }
        }
        // Silently ignore: answer arrived but we're already stable (duplicate broadcast)
      }

      // ── ICE candidate ──
      else if (message.type === 'ice-candidate' && message.target === userName) {
        const pc = peersRef.current[message.from];
        if (!pc) return;

        if (pc.remoteDescription && pc.remoteDescription.type) {
          // Remote description already set → add immediately
          try {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
          } catch (e) {
            console.warn('ICE candidate error:', e);
          }
        } else {
          // Remote description not set yet → queue for later
          if (!iceCandidateQueue.current[message.from]) {
            iceCandidateQueue.current[message.from] = [];
          }
          iceCandidateQueue.current[message.from].push(message.candidate);
        }
      }

      // ── Someone left ──
      else if (message.type === 'user_left') {
        setParticipants((prev) => prev.filter((p) => p.name !== message.user));
        if (peersRef.current[message.user]) {
          peersRef.current[message.user].close();
          delete peersRef.current[message.user];
        }
        delete iceCandidateQueue.current[message.user];
        delete negotiatingRef.current[message.user];
      }
    };

    ws.onerror = () => setConnectionStatus('error');
    ws.onclose = () => setConnectionStatus('disconnected');
  }, [id, userName, createPeerConnection, flushIceCandidates]);

  // ─── 4. INITIALIZE ────────────────────────────────────────
  useEffect(() => {
    // Prevent React Strict Mode from running init twice in dev
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      try {
        const meetingRes = await getMeeting(id);
        setMeeting(meetingRes.data);

        const participantRes = await getParticipants(id);
        setParticipants(participantRes.data);

        await startLocalStream();
        connectWebSocket();
        setInitDone(true);
      } catch (err) {
        if (err.response?.status === 404) {
          alert('Meeting not found!');
          router.push('/join');
        } else {
          console.error('Init error:', err);
          setConnectionStatus('error');
          setInitDone(true);
        }
      }
    };

    init();

    return () => {
      initializedRef.current = false;
      if (localStream.current) {
        localStream.current.getTracks().forEach((t) => t.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      iceCandidateQueue.current = {};
      negotiatingRef.current = {};
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── CONTROLS ─────────────────────────────────────────────

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleLeaveOrEnd = async () => {
    try {
      if (isHost) {
        await endMeeting(id);
      } else {
        const participantId = localStorage.getItem('participantId');
        if (participantId) await leaveMeeting(participantId);
      }
    } catch (e) {
      console.warn('Cleanup error', e);
    }
    if (localStream.current) localStream.current.getTracks().forEach((t) => t.stop());
    if (wsRef.current) wsRef.current.close();
    router.push('/');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ─── STATUS HELPERS ────────────────────────────────────────
  const statusColor = {
    connecting: '#f59e0b',
    connected: '#10b981',
    error: '#ef4444',
    disconnected: '#6b7280',
  };

  const statusLabel = {
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection Error',
    disconnected: 'Disconnected',
  };

  // Remote participants (excluding self)
  const remoteParticipants = participants.filter((p) => p.name !== userName);

  // ─── RENDER ───────────────────────────────────────────────

  if (!initDone) {
    return (
      <div
        style={{
          height: '100vh',
          background: '#111827',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          color: '#fff',
        }}
      >
        <Loader2 size={40} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '15px', color: '#9ca3af' }}>Setting up your meeting...</p>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        background: '#111827',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── TOP BAR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: '#1f2937',
          borderBottom: '1px solid #374151',
          flexShrink: 0,
        }}
      >
        {/* Left: meeting info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
              borderRadius: '8px',
              padding: '5px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Video size={14} color="#fff" />
          </div>
          <span style={{ color: '#f9fafb', fontWeight: 600, fontSize: '15px' }}>
            {meeting?.title || 'Meeting Room'}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#374151',
              borderRadius: '6px',
              padding: '4px 10px',
            }}
          >
            <span style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'monospace' }}>
              Invite Link
            </span>
            <button
              id="copy-meeting-link-btn"
              onClick={copyLink}
              title="Copy meeting link"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: copied ? '#10b981' : '#6b7280',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
          {isHost && (
            <span
              style={{
                background: '#0B5CFF22',
                color: '#60a5fa',
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '100px',
                border: '1px solid #1d4ed844',
              }}
            >
              HOST
            </span>
          )}
        </div>

        {/* Right: connection status + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: statusColor[connectionStatus] || '#6b7280',
                boxShadow: `0 0 6px ${statusColor[connectionStatus] || '#6b7280'}`,
              }}
            />
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>
              {statusLabel[connectionStatus] || connectionStatus}
            </span>
          </div>
          <span style={{ color: '#4b5563', fontSize: '12px' }}>
            {meeting?.duration && `${meeting.duration} min`}
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── VIDEO AREA ── */}
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'auto' }}>
          {/* Camera error notice */}
          {cameraError && (
            <div
              style={{
                background: '#422006',
                border: '1px solid #78350f',
                borderRadius: '10px',
                padding: '12px 16px',
                color: '#fbbf24',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <WifiOff size={15} />
              Camera/microphone access denied. Video and audio features are unavailable.
            </div>
          )}

          {/* Video Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: remoteParticipants.length === 0 ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '12px',
              flex: 1,
              alignContent: 'start',
            }}
          >
            {/* Local (self) video */}
            <div
              style={{
                background: '#1f2937',
                borderRadius: '14px',
                overflow: 'hidden',
                position: 'relative',
                minHeight: '240px',
                border: '2px solid #374151',
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: isVideoOff ? 'none' : 'block',
                  minHeight: '240px',
                }}
              />
              {(isVideoOff || cameraError) && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#1f2937',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0B5CFF, #0047CC)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '28px',
                      fontWeight: 700,
                      color: '#fff',
                      boxShadow: '0 4px 20px rgba(11,92,255,0.4)',
                    }}
                  >
                    {userName.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              {/* Name tag */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                {isMuted && <MicOff size={11} color="#f87171" />}
                {userName} {isHost ? '(You · Host)' : '(You)'}
              </div>
            </div>

            {/* Remote participants' videos */}
            {remoteParticipants.map((participant) => (
              <div
                key={participant.name}
                style={{
                  background: '#1f2937',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  position: 'relative',
                  minHeight: '240px',
                  border: '2px solid #374151',
                }}
              >
                <video
                  id={`video-${participant.name}`}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    minHeight: '240px',
                  }}
                />
                {/* Fallback avatar */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#1f2937',
                    zIndex: 0,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '28px',
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                {/* Name tag */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '4px 10px',
                    borderRadius: '100px',
                    zIndex: 1,
                  }}
                >
                  {participant.name}
                  {participant.is_host && (
                    <span style={{ color: '#60a5fa', marginLeft: '4px' }}>(Host)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PARTICIPANTS SIDEBAR ── */}
        {showParticipants && (
          <div
            style={{
              width: '260px',
              background: '#1f2937',
              borderLeft: '1px solid #374151',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #374151',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Users size={15} color="#9ca3af" />
              <span style={{ color: '#f9fafb', fontWeight: 600, fontSize: '14px' }}>
                Participants ({participants.length})
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {participants.map((p) => (
                <div
                  key={p.id || p.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    marginBottom: '4px',
                    background: p.name === userName ? '#0B5CFF22' : 'transparent',
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background:
                        p.name === userName
                          ? 'linear-gradient(135deg, #0B5CFF, #0047CC)'
                          : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        color: '#f9fafb',
                        fontSize: '13px',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.name}
                      {p.name === userName && (
                        <span style={{ color: '#9ca3af', fontSize: '11px', marginLeft: '4px' }}>
                          (you)
                        </span>
                      )}
                    </p>
                    {p.is_host && (
                      <span style={{ color: '#60a5fa', fontSize: '11px' }}>Host</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── CONTROL BAR ── */}
      <div
        style={{
          background: '#1f2937',
          borderTop: '1px solid #374151',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {/* Mute */}
        <ControlButton
          id="toggle-mute-btn"
          onClick={toggleMute}
          active={isMuted}
          activeColor="#dc2626"
          icon={isMuted ? <MicOff size={20} color="#fff" /> : <Mic size={20} color="#fff" />}
          label={isMuted ? 'Unmute' : 'Mute'}
        />

        {/* Video */}
        <ControlButton
          id="toggle-video-btn"
          onClick={toggleVideo}
          active={isVideoOff}
          activeColor="#dc2626"
          icon={isVideoOff ? <VideoOff size={20} color="#fff" /> : <Video size={20} color="#fff" />}
          label={isVideoOff ? 'Start Video' : 'Stop Video'}
        />

        {/* Security (placeholder) */}
        <ControlButton
          id="security-btn"
          onClick={() => {}}
          icon={<Shield size={20} color="#fff" />}
          label="Security"
        />

        {/* Participants toggle */}
        <ControlButton
          id="toggle-participants-btn"
          onClick={() => setShowParticipants((p) => !p)}
          active={showParticipants}
          activeColor="#0B5CFF"
          icon={<Users size={20} color="#fff" />}
          label={`Participants${participants.length > 0 ? ` (${participants.length})` : ''}`}
        />

        {/* Chat (placeholder) */}
        <ControlButton
          id="chat-btn"
          onClick={() => {}}
          icon={<MessageSquare size={20} color="#fff" />}
          label="Chat"
        />

        {/* Leave / End */}
        <button
          id="end-meeting-btn"
          onClick={handleLeaveOrEnd}
          title={isHost ? 'End meeting for all' : 'Leave meeting'}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            marginLeft: '12px',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
            transition: 'transform 0.15s, opacity 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.04)';
            e.currentTarget.style.opacity = '0.93';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.opacity = '1';
          }}
        >
          <Phone size={20} color="#fff" style={{ transform: 'rotate(135deg)' }} />
          <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {isHost ? 'End' : 'Leave'}
          </span>
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Control Button Component ──────────────────────────────────
function ControlButton({ id, onClick, active, activeColor, icon, label }) {
  return (
    <button
      id={id}
      onClick={onClick}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '10px 16px',
        background: active ? (activeColor || '#374151') : '#374151',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'background 0.15s, transform 0.15s',
        minWidth: '64px',
        boxShadow: active && activeColor ? `0 2px 8px ${activeColor}55` : 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = '#4b5563';
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? (activeColor || '#374151') : '#374151';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {icon}
      <span style={{ color: '#d1d5db', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}
