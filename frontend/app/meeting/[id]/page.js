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
        setMeeting(meetingRes.data);

        const participantRes = await getParticipants(id);
        if (!active) return;
        setParticipants(participantRes.data);

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

  // ─── RESPONSIVE GRID LAYOUT ────────────────────────────────
  // Returns CSS grid template based on total tile count
  const totalTiles = remoteParticipants.length + 1; // +1 for self
  const getGridStyle = (count) => {
    if (count === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    if (count === 2) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
    if (count === 3) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }; // 3rd tile spans
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
              // When 3 tiles, let the 3rd span the full bottom row
              ...(totalTiles === 3 ? { gridTemplateAreas: '"a b" "c c"' } : {}),
            }}
          >
            {/* Local (self) video */}
            <div
              style={{
                background: '#1f2937',
                borderRadius: '14px',
                overflow: 'hidden',
                position: 'relative',
                border: '2px solid #374151',
                // When alone, add a subtle inner glow
                boxShadow: totalTiles === 1 ? '0 0 0 1px #374151 inset' : 'none',
                // 3-tile: take top-left cell
                ...(totalTiles === 3 ? { gridArea: 'a' } : {}),
              }}
            >
              <video
                ref={(el) => {
                  // ref callback: fires when element mounts/unmounts
                  localVideoRef.current = el;
                  // Immediately attach stream if already acquired (handles post-initDone mount)
                  if (el && localStream.current) {
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
                  zIndex: 2,
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
                  background: '#1f2937',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  position: 'relative',
                  border: '2px solid #374151',
                  // 3-tile: 2nd goes top-right, 3rd spans full bottom
                  ...(totalTiles === 3 && idx === 0 ? { gridArea: 'b' } : {}),
                  ...(totalTiles === 3 && idx === 1 ? { gridArea: 'c' } : {}),
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
                    zIndex: 3, // above video (2) and avatar (0)
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

        {/* ── CHAT SIDEBAR ── */}
        {showChat && (
          <div
            style={{
              width: '320px',
              background: '#1f2937',
              borderLeft: '1px solid #374151',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #374151',
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
                          backgroundColor: isOwn ? '#0B5CFF' : '#374151',
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
                borderTop: '1px solid #374151',
                display: 'flex',
                gap: '8px',
                background: '#111827',
              }}
            >
              <input
                type="text"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                placeholder="Send a message..."
                style={{
                  flex: 1,
                  background: '#1f2937',
                  border: '1px solid #374151',
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

        {/* Chat toggle */}
        <ControlButton
          id="chat-btn"
          onClick={() => setShowChat((c) => !c)}
          active={showChat}
          activeColor="#0B5CFF"
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
