'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Mic, MicOff, Video, VideoOff, Phone,
  Users, MessageSquare, Shield, Copy, Check,
  Wifi, WifiOff, Loader2, ChevronUp, Smile,
  MoreHorizontal, LayoutGrid, ShieldCheck
} from 'lucide-react';
import { getMeeting, getParticipants, endMeeting, leaveMeeting, joinMeeting } from '@/lib/api';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

const getAvatarColor = (name) => {
  const colors = [
    '#e05638', // Zoom-style orange/red
    '#0f75bc', // Zoom-style blue
    '#7f3f98', // Zoom-style purple
    '#00a651', // Zoom-style green
    '#ea580c', // Orange
    '#2563eb'  // Blue
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function MeetingRoom() {
  const router = useRouter();
  const { id } = useParams();

  // ─── STATE ────────────────────────────────────────────────
  const [meeting, setMeeting]                   = useState(null);
  const [participants, setParticipants]         = useState([]);
  const [isMuted, setIsMuted]                   = useState(false);
  const [isVideoOff, setIsVideoOff]             = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [copiedId, setCopiedId]                 = useState(false);
  const [copiedLink, setCopiedLink]             = useState(false);
  const [showInvitePopup, setShowInvitePopup]   = useState(true);
  const [isFullscreen, setIsFullscreen]         = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | connected | error | disconnected
  const [cameraError, setCameraError]           = useState(false);
  const [initDone, setInitDone]                 = useState(false);
  const [showChat, setShowChat]                 = useState(false);
  const [chatMessages, setChatMessages]         = useState([]);
  const [newMessageText, setNewMessageText]     = useState('');

  const [userName, setUserName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const userNameRef = useRef('');

  // ─── REFS ─────────────────────────────────────────────────
  const localVideoRef     = useRef(null);
  const localStream       = useRef(null);
  const wsRef             = useRef(null);
  const peersRef          = useRef({});
  // ICE candidates that arrive before remoteDescription is set are queued here
  const iceCandidateQueue = useRef({}); // { userName: [RTCIceCandidateInit, ...] }
  // Per-peer negotiation lock — prevents duplicate offer/answer while one is in flight
  const negotiatingRef    = useRef({}); // { userName: boolean }
  // Stores remote MediaStreams so they can be re-attached after React re-renders the video elements
  const remoteStreamsRef  = useRef({}); // { userName: MediaStream }

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

      // On remote stream → store it, then attach to video element if already in DOM
      pc.ontrack = (event) => {
        if (!event.streams[0]) return;
        const stream = event.streams[0];
        // Always persist the stream so we can reattach if the element hasn't rendered yet
        remoteStreamsRef.current[targetUser] = stream;
        const remoteVideo = document.getElementById(`video-${targetUser}`);
        if (remoteVideo) {
          remoteVideo.srcObject = stream;
        }
        // Trigger re-render so the useEffect below can catch and attach if element wasn't ready
        setParticipants((prev) => {
          if (prev.find((p) => p.name === targetUser)) return prev;
          return [...prev, { name: targetUser, is_host: false }];
        });
      };

      // Send ICE candidates via WebSocket
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate,
              target: targetUser,
              from: userNameRef.current,
            })
          );
        }
      };

      peersRef.current[targetUser] = pc;
      return pc;
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
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

  // ─── REATTACH REMOTE STREAMS AFTER REACT RE-RENDERS ───────────
  // When participants list changes, React may create new video elements.
  // If ontrack already fired before the element existed, reattach from the stored ref.
  useEffect(() => {
    Object.entries(remoteStreamsRef.current).forEach(([peerName, stream]) => {
      const el = document.getElementById(`video-${peerName}`);
      if (el && el.srcObject !== stream) {
        el.srcObject = stream;
      }
    });
  }, [participants]); // runs every time participants list changes

  // ─── ATTACH LOCAL STREAM ONCE MEETING UI IS VISIBLE ─────────
  // startLocalStream runs BEFORE initDone=true renders the video element,
  // so localVideoRef.current is null at that point. This effect fires after
  // the video element mounts and ensures srcObject is always attached.
  useEffect(() => {
    if (initDone && localStream.current && localVideoRef.current) {
      if (localVideoRef.current.srcObject !== localStream.current) {
        localVideoRef.current.srcObject = localStream.current;
      }
    }
  }, [initDone]);

  // ─── 3. WEBSOCKET + SIGNALING ────────────────────────────
  const connectWebSocket = useCallback((nameToUse) => {
    // Guard against duplicate connection attempts
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket connection already active or connecting');
      return;
    }
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_BASE}/ws/${id}/${encodeURIComponent(nameToUse)}`);
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
      if (message.type === 'user_joined' && message.user !== nameToUse) {
        // Guard: skip if already negotiating with this user
        if (negotiatingRef.current[message.user]) return;
        negotiatingRef.current[message.user] = true;

        const pc = createPeerConnection(message.user);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: 'offer', offer, target: message.user, from: nameToUse }));
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
      else if (message.type === 'offer' && message.target === nameToUse) {
        const pc = createPeerConnection(message.from);
        try {
          // Only accept offer when in correct state
          if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-pranswer') {
            await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
            await flushIceCandidates(message.from); // apply any queued candidates
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', answer, target: message.from, from: nameToUse }));
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
      else if (message.type === 'answer' && message.target === nameToUse) {
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
      }

      // ── ICE candidate ──
      else if (message.type === 'ice-candidate' && message.target === nameToUse) {
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

      // ── Received a chat message ──
      else if (message.type === 'chat') {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: message.sender,
            text: message.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
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
  }, [id, createPeerConnection, flushIceCandidates]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    const container = document.getElementById('chat-messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [chatMessages]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Click-outside listener for View dropdown
  useEffect(() => {
    if (!showViewDropdown) return;
    const closeDropdown = () => setShowViewDropdown(false);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, [showViewDropdown]);

  const sendChatMessage = (e) => {
    if (e) e.preventDefault();
    if (!newMessageText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const msg = {
      type: 'chat',
      sender: userNameRef.current,
      text: newMessageText.trim()
    };
    wsRef.current.send(JSON.stringify(msg));
    setNewMessageText('');
  };

  // ─── 4. INITIALIZE ────────────────────────────────────────
  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    const storedIsHost = localStorage.getItem('isHost') === 'true';
    if (!storedName) {
      router.push(`/join?id=${id}`);
      return;
    }
    setUserName(storedName);
    userNameRef.current = storedName;
    setIsHost(storedIsHost);

    let active = true;

    const init = async () => {
      try {
        const meetingRes = await getMeeting(id);
        if (!active) return;
        const meetingData = meetingRes.data;
        setMeeting(meetingData);

        const participantRes = await getParticipants(id);
        if (!active) return;
        const currentParticipants = participantRes.data;

        // Check if we need to register this participant in the database
        const storedParticipantMeetingId = localStorage.getItem('participantMeetingId');
        if (storedParticipantMeetingId !== id) {
          const existingParticipant = currentParticipants.find((p) => p.name === storedName);
          const userIsHost = meetingData.host_name === storedName;

          if (existingParticipant) {
            localStorage.setItem('participantId', String(existingParticipant.id));
            localStorage.setItem('participantMeetingId', id);
            localStorage.setItem('isHost', String(existingParticipant.is_host));
            setIsHost(existingParticipant.is_host);
          } else {
            try {
              const joinRes = await joinMeeting({
                meeting_id: id,
                name: storedName,
                is_host: userIsHost,
              });
              const actualName = joinRes.data.name;
              localStorage.setItem('userName', actualName);
              setUserName(actualName);
              userNameRef.current = actualName;

              localStorage.setItem('participantId', String(joinRes.data.id));
              localStorage.setItem('participantMeetingId', id);
              localStorage.setItem('isHost', String(userIsHost));
              setIsHost(userIsHost);
              currentParticipants.push(joinRes.data);
            } catch (joinErr) {
              console.error('Failed to auto-register participant:', joinErr);
            }
          }
        }

        setParticipants(currentParticipants);

        const stream = await startLocalStream();
        if (!active) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        connectWebSocket(storedName);
        setInitDone(true);
      } catch (err) {
        if (!active) return;
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

    // Cleanup: stop all tracks, close WS, close all peer connections
    return () => {
      active = false;
      if (localStream.current) {
        localStream.current.getTracks().forEach((t) => t.stop());
        localStream.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // suppress the status update on intentional close
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

  const copyMeetingId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  };

  const copyMeetingLink = () => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.clipboard) {
      const origin = window.location.origin;
      navigator.clipboard.writeText(`${origin}/meeting/${id}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const toggleFullscreen = () => {
    if (typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch((err) => {
            console.warn(`Error attempting to exit fullscreen: ${err.message}`);
          });
        }
      }
    }
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

  // ─── RESPONSIVE GRID LAYOUT ────────────────────────────────
  // Returns CSS grid template based on total tile count
  const totalTiles = remoteParticipants.length + 1; // +1 for self
  const getGridStyle = (count) => {
    if (count === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    if (count === 2) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
    if (count === 3) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr' }; // 3 side-by-side
    if (count === 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    if (count <= 6) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr' };
    if (count <= 9) return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr' };
    return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto' };
  };
  const gridLayout = getGridStyle(totalTiles);

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
        background: '#0c0c0c',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── TOP BAR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 20px',
          background: '#000000',
          borderBottom: '1px solid #141414',
          height: '46px',
          flexShrink: 0,
        }}
      >
        {/* Left: MeetFlow branding & meeting info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '14px', letterSpacing: '-0.3px' }}>
              MeetFlow
            </span>
            <span style={{ color: '#8e8e8f', fontWeight: 400, marginLeft: '4px', fontSize: '12px' }}>
              Workplace
            </span>
          </div>
          
          {meeting?.title && meeting.title !== 'Meeting Room' && meeting.title !== 'My Instant Meeting' && (
            <>
              <div style={{ width: '1px', height: '14px', background: '#333333' }} />
              <span style={{ color: '#e5e7eb', fontWeight: 500, fontSize: '13px' }}>
                {meeting.title}
              </span>
            </>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '4px',
              padding: '3px 8px',
            }}
          >
            <span style={{ color: '#a3a3a3', fontSize: '11px', fontWeight: 500 }}>
              Meeting ID: <span style={{ color: '#f3f4f6', fontFamily: 'monospace', marginLeft: '2px' }}>{id}</span>
            </span>
            <button
              id="copy-meeting-id-btn"
              onClick={copyMeetingId}
              title="Copy meeting ID"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: copiedId ? '#10b981' : '#8e8e8f',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s',
              }}
            >
              {copiedId ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>

          {isHost && (
            <span
              style={{
                background: 'rgba(11, 92, 255, 0.15)',
                color: '#60a5fa',
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(29, 78, 216, 0.3)',
              }}
            >
              HOST
            </span>
          )}
        </div>

        {/* Center/Right: Secure Connection Shield & View Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Green Secure Connection Shield */}
          <div 
            title={statusLabel[connectionStatus] || connectionStatus}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'help',
              transition: 'opacity 0.15s'
            }}
          >
            {connectionStatus === 'connected' ? (
              <ShieldCheck size={18} color="#10b981" />
            ) : (
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: statusColor[connectionStatus] || '#6b7280',
                  boxShadow: `0 0 6px ${statusColor[connectionStatus] || '#6b7280'}`,
                }}
              />
            )}
          </div>

          <div style={{ width: '1px', height: '14px', background: '#333333' }} />

          {/* Zoom View Dropdown Toggle Container */}
          <div style={{ position: 'relative' }}>
            <button
              id="view-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowViewDropdown((prev) => !prev);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: 'pointer',
                color: '#f3f4f6',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
            >
              <LayoutGrid size={13} color="#f3f4f6" />
              <span>View</span>
            </button>

            {showViewDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '32px',
                  right: 0,
                  width: '160px',
                  background: '#18181b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '4px 0',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5)',
                  zIndex: 200,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen();
                    setShowViewDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '8px 12px',
                    textAlign: 'left',
                    color: '#f3f4f6',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontSize: '13px', width: '14px', display: 'inline-block', textAlign: 'center' }}>⛶</span>
                  <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── VIDEO AREA ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Camera error notice */}
          {cameraError && (
            <div
              style={{
                background: '#422006',
                border: '1px solid #78350f',
                borderRadius: '10px',
                padding: '10px 16px',
                margin: '12px 12px 0',
                color: '#fbbf24',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0,
              }}
            >
              <WifiOff size={15} />
              Camera/microphone access denied. Video and audio features are unavailable.
            </div>
          )}

          {/* Video Grid — fills all remaining height */}
          <div
            style={{
              flex: 1,
              display: 'grid',
              ...gridLayout,
              gap: '10px',
              padding: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Local (self) video */}
            <div
              style={{
                background: '#161616',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid #2d2d2d',
                width: '100%',
                height: '100%',
              }}
            >
              <video
                ref={(el) => {
                  // ref callback: fires when element mounts/unmounts
                  localVideoRef.current = el;
                  // Immediately attach stream if already acquired (handles post-initDone mount)
                  if (el && localStream.current && el.srcObject !== localStream.current) {
                    el.srcObject = localStream.current;
                  }
                }}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: isVideoOff ? 'none' : 'block',
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1,
                }}
              />
              {/* Height anchor: keeps the tile in the grid when video is off */}
              <div style={{ width: '100%', height: '100%', minHeight: '200px' }} />
              {(isVideoOff || cameraError) && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#161616',
                  }}
                >
                  <div
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '8px',
                      background: getAvatarColor(userName),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      fontWeight: 700,
                      color: '#fff',
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
                  background: 'rgba(0, 0, 0, 0.55)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 2,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                {isMuted && <MicOff size={11} color="#f87171" />}
                {userName} {isHost ? '(You · Host)' : '(You)'}
              </div>
            </div>

            {/* Remote participants' videos */}
            {remoteParticipants.map((participant, idx) => (
              <div
                key={participant.name}
                style={{
                  background: '#161616',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid #2d2d2d',
                  width: '100%',
                  height: '100%',
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
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2, // must be above the avatar (zIndex:0) so video is visible
                  }}
                />
                {/* Invisible height placeholder */}
                <div style={{ height: '100%' }} />
                {/* Fallback avatar */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#161616',
                    zIndex: 0,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '8px',
                      background: getAvatarColor(participant.name),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
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
                    background: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(8px)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    zIndex: 3, // above video (2) and avatar (0)
                    border: '1px solid rgba(255, 255, 255, 0.05)',
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
              background: '#161616',
              borderLeft: '1px solid #2d2d2d',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #2d2d2d',
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
                    borderRadius: '6px',
                    marginBottom: '4px',
                    background: p.name === userName ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    border: p.name === userName ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid transparent',
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: getAvatarColor(p.name),
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

        {/* ── CHAT SIDEBAR ── */}
        {showChat && (
          <div
            style={{
              width: '320px',
              background: '#161616',
              borderLeft: '1px solid #2d2d2d',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #2d2d2d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={15} color="#9ca3af" />
                <span style={{ color: '#f9fafb', fontWeight: 600, fontSize: '14px' }}>
                  In-call Messages
                </span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Messages list */}
            <div
              id="chat-messages-container"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '12px', lineHeight: 1.5 }}>
                  Messages can only be seen by people in the call, and are deleted when the call ends.
                </div>
              ) : (
                chatMessages.map((msg, index) => {
                  const isOwn = msg.sender === userName;
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isOwn ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        alignSelf: isOwn ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#9ca3af',
                          marginBottom: '2px',
                          paddingLeft: '4px',
                          paddingRight: '4px',
                        }}
                      >
                        {isOwn ? 'You' : msg.sender} • {msg.time}
                      </span>
                      <div
                        style={{
                          backgroundColor: isOwn ? '#0B5CFF' : '#2d2d2d',
                          color: '#ffffff',
                          borderRadius: '12px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                          borderTopRightRadius: isOwn ? '2px' : '12px',
                          borderTopLeftRadius: isOwn ? '12px' : '2px',
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input form */}
            <form
              onSubmit={sendChatMessage}
              style={{
                padding: '12px 16px',
                borderTop: '1px solid #2d2d2d',
                display: 'flex',
                gap: '8px',
                background: '#0f0f0f',
              }}
            >
              <input
                type="text"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                placeholder="Send a message..."
                style={{
                  flex: 1,
                  background: '#1d1d1d',
                  border: '1px solid #2d2d2d',
                  borderRadius: '20px',
                  padding: '8px 16px',
                  color: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#0B5CFF',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                ➤
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── CONTROL BAR ── */}
      <div
        style={{
          background: '#000000',
          borderTop: '1px solid #1c1c1c',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          height: '80px',
          position: 'relative',
        }}
      >
        {/* Left spacer for perfect centering */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          {/* Empty to balance the layout and keep controls centered */}
        </div>

        {/* Center: Main Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Mute */}
          <ControlButton
            id="toggle-mute-btn"
            onClick={toggleMute}
            active={isMuted}
            icon={isMuted ? <MicOff size={20} color="#ef4444" /> : <Mic size={20} color="#fff" />}
            label="Audio"
            hasChevron={true}
          />

          {/* Video */}
          <ControlButton
            id="toggle-video-btn"
            onClick={toggleVideo}
            active={isVideoOff}
            icon={isVideoOff ? <VideoOff size={20} color="#ef4444" /> : <Video size={20} color="#fff" />}
            label="Video"
            hasChevron={true}
          />

          {/* Participants */}
          <ControlButton
            id="toggle-participants-btn"
            onClick={() => setShowParticipants((p) => !p)}
            active={showParticipants}
            icon={
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Users size={20} color="#fff" />
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-8px',
                    background: '#555555',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    padding: '1px 4px',
                    minWidth: '12px',
                    textAlign: 'center',
                    border: '1px solid #000000',
                  }}
                >
                  {participants.length}
                </span>
              </div>
            }
            label="Participants"
            hasChevron={true}
          />

          {/* Chat */}
          <ControlButton
            id="chat-btn"
            onClick={() => setShowChat((c) => !c)}
            active={showChat}
            icon={<MessageSquare size={20} color="#fff" />}
            label="Chat"
            hasChevron={true}
          />
        </div>

        {/* Right: End / Leave Button */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', paddingRight: '12px' }}>
          <button
            id="end-meeting-btn"
            onClick={handleLeaveOrEnd}
            title={isHost ? 'End meeting for all' : 'Leave meeting'}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              gap: '4px',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s, transform 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#b91c1c';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#dc2626';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold', lineHeight: 1 }}>✕</span>
            </div>
            <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>
              {isHost ? 'End' : 'Leave'}
            </span>
          </button>
        </div>
      </div>
      
      {/* ── FLOATING INVITATION POP-UP (BOTTOM LEFT) ── */}
      {showInvitePopup && (
        <div
          className="invite-popup-animation"
          style={{
            position: 'absolute',
            bottom: '96px',
            left: '24px',
            width: '320px',
            backgroundColor: '#18181b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            zIndex: 100,
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '14px' }}>
                Invite Participants
              </span>
            </div>
            <button
              onClick={() => setShowInvitePopup(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px',
                lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
            >
              ✕
            </button>
          </div>

          {/* Description */}
          <p style={{ color: '#a1a1aa', fontSize: '12px', lineHeight: '1.5', margin: '0 0 12px 0' }}>
            Copy the meeting link below and share it with others to invite them to this meeting.
          </p>

          {/* Input & Copy Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              readOnly
              value={typeof window !== 'undefined' ? `${window.location.origin}/meeting/${id}` : ''}
              style={{
                width: '100%',
                background: '#09090b',
                border: '1px solid #27272a',
                borderRadius: '6px',
                padding: '8px 10px',
                color: '#e4e4e7',
                fontSize: '11px',
                fontFamily: 'monospace',
                outline: 'none',
                textOverflow: 'ellipsis',
              }}
              onClick={(e) => e.currentTarget.select()}
            />
            <button
              onClick={copyMeetingLink}
              style={{
                width: '100%',
                background: copiedLink ? '#10b981' : '#0B5CFF',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background-color 0.15s, transform 0.1s',
              }}
              onMouseEnter={(e) => {
                if (!copiedLink) e.currentTarget.style.background = '#024ecf';
              }}
              onMouseLeave={(e) => {
                if (!copiedLink) e.currentTarget.style.background = '#0B5CFF';
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .invite-popup-animation {
          animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}

// ─── Control Button Component ──────────────────────────────────
function ControlButton({ id, onClick, active, activeColor, icon, label, hasChevron }) {
  const isMuteOrVideo = id === 'toggle-mute-btn' || id === 'toggle-video-btn';
  const bg = active && !isMuteOrVideo 
    ? 'rgba(255, 255, 255, 0.15)' 
    : 'transparent';

  return (
    <button
      id={id}
      onClick={onClick}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: bg,
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'background 0.15s, transform 0.1s',
        minWidth: '80px',
        height: '58px',
      }}
      onMouseEnter={(e) => {
        if (!(active && !isMuteOrVideo)) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = bg;
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.96)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', position: 'relative' }}>
        {icon}
        {hasChevron && (
          <ChevronUp size={11} color="#9ca3af" style={{ marginLeft: '1px', alignSelf: 'center', marginTop: '2px' }} />
        )}
      </div>
      <span style={{ color: '#e5e7eb', fontSize: '11px', fontWeight: 400, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}
