/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React Strict Mode in dev to prevent double-mounting,
  // which would create 2 WebSocket connections per user and break WebRTC signaling.
  // Strict Mode's double-invocation of useEffect is fundamentally incompatible
  // with persistent connections (WebSocket, WebRTC, MediaStream).
  reactStrictMode: false,
};

export default nextConfig;
