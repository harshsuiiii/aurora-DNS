import * as dgram from "dgram";
import DNSHeader from "./dns/header.ts";
import DNSQuestion from "./dns/question.ts";
import DNSAnswer from "./dns/answer.ts";

const LOCAL_PORT = 2053;
const LOCAL_HOST = "127.0.0.1";
const UPSTREAM_DNS = "8.8.8.8"; // Google DNS
const UPSTREAM_PORT = 53;

const udpSocket: dgram.Socket = dgram.createSocket("udp4");
const upstreamSocket: dgram.Socket = dgram.createSocket("udp4");

// ✅ TTL-aware cache by (name|type|class)
const cache: Record<string, { buffer: Buffer; expiresAt: number }> = {};

// ✅ Utility: Build cache key
const getCacheKey = (name: string, type: number, classCode: number): string =>
  `${name.toLowerCase()}|${type}|${classCode}`;

// ✅ Utility: Send UDP packets as a promise
const sendUDP = (socket: dgram.Socket, message: Buffer, port: number, host: string): Promise<void> =>
  new Promise((resolve, reject) => {
    socket.send(message, port, host, (err) => (err ? reject(err) : resolve()));
  });

// ✅ Start local DNS forwarding server
udpSocket.bind(LOCAL_PORT, LOCAL_HOST, () => {
  console.log(`🚀 DNS Forwarding Server with TTL-aware Cache running on ${LOCAL_HOST}:${LOCAL_PORT}`);
});

udpSocket.on("message", async (queryBuffer: Buffer, remoteAddr: dgram.RemoteInfo) => {
  try {
    // Parse the incoming DNS query
    const parsedHeader = DNSHeader.parse(queryBuffer);
    const { questions } = DNSQuestion.parse(queryBuffer, 12);
    if (questions.length === 0) return;

    const query = questions[0];
    const cacheKey = getCacheKey(query.name, query.type, query.ClassCode);
    const now = Date.now();

    console.log(`📩 Received query for ${cacheKey} from ${remoteAddr.address}:${remoteAddr.port}`);

    // ✅ 1️⃣ Check cache for existing entry
    const cached = cache[cacheKey];
    if (cached && cached.expiresAt > now) {
      console.log(`⚡ Cache HIT for ${cacheKey} (TTL remaining: ${(cached.expiresAt - now) / 1000}s)`);
      await sendUDP(udpSocket, cached.buffer, remoteAddr.port, remoteAddr.address);
      return;
    }

    console.log(`🛰️ Cache MISS for ${cacheKey} → forwarding to ${UPSTREAM_DNS}`);

    // ✅ 2️⃣ Forward query to upstream resolver
    await sendUDP(upstreamSocket, queryBuffer, UPSTREAM_PORT, UPSTREAM_DNS);

    // ✅ 3️⃣ Wait for upstream response
    upstreamSocket.once("message", async (upstreamResponse: Buffer) => {
      console.log(`⬅️ Received response from ${UPSTREAM_DNS}`);

      // Parse upstream DNS response for debugging/logging
      const header = DNSHeader.parse(upstreamResponse);
      const { questions, bytesRead } = DNSQuestion.parse(upstreamResponse, 12);
      const { answers } = DNSAnswer.parse(upstreamResponse, 12 + bytesRead);

      console.log("📬 Upstream Header:", header);
      console.log("💡 Answers:", answers);

      // ✅ 4️⃣ Extract TTL from first answer
      let ttl = 60;
      if (answers.length > 0 && answers[0].ttl) ttl = answers[0].ttl;

      // ✅ 5️⃣ Cache the upstream response using tuple key
      cache[cacheKey] = {
        buffer: upstreamResponse,
        expiresAt: now + ttl * 1000,
      };
      console.log(`💾 Cached ${cacheKey} for ${ttl}s`);

      // ✅ 6️⃣ Send response back to the original client
      await sendUDP(udpSocket, upstreamResponse, remoteAddr.port, remoteAddr.address);
      console.log(`✅ Forwarded response for ${cacheKey} to ${remoteAddr.address}:${remoteAddr.port}\n`);
    });
  } catch (err) {
    console.error("❌ Error processing DNS request:", err);
  }
});

// ✅ Periodically clean expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Object.entries(cache)) {
    if (entry.expiresAt < now) {
      delete cache[key];
      console.log(`🧹 Expired cache entry for ${key}`);
    }
  }
}, 60_000);

// ✅ Error handling
udpSocket.on("error", (err) => {
  console.error("💥 Local server error:", err);
  udpSocket.close();
});

upstreamSocket.on("error", (err) => {
  console.error("💥 Upstream socket error:", err);
  upstreamSocket.close();
});
