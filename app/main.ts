import * as dgram from "dgram";
import DNSHeader from "./dns/header.ts";
import DNSQuestion from "./dns/question.ts";
import DNSAnswer from "./dns/answer.ts";

const LOCAL_PORT = 2053;
const LOCAL_HOST = "127.0.0.1";

// Multiple upstream resolvers (primary → fallback)
const UPSTREAMS = [
  { host: "8.8.8.8", port: 53, name: "GoogleDNS" },
  { host: "1.1.1.1", port: 53, name: "CloudflareDNS" },
];

const udpSocket: dgram.Socket = dgram.createSocket("udp4");
const upstreamSocket: dgram.Socket = dgram.createSocket("udp4");

// TTL-aware cache by (name|type|class)
const cache: Record<string, { buffer: Buffer; expiresAt: number }> = {};

// Utility: Build cache key
const getCacheKey = (name: string, type: number, classCode: number): string =>
  `${name.toLowerCase()}|${type}|${classCode}`;

// ✅ Utility: Send UDP packet (Promise-based)
const sendUDP = (socket: dgram.Socket, message: Buffer, port: number, host: string): Promise<void> =>
  new Promise((resolve, reject) => {
    socket.send(message, port, host, (err) => (err ? reject(err) : resolve()));
  });

// Promise-based listener with timeout
const waitForMessage = (socket: dgram.Socket, timeoutMs: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("⏰ Upstream timeout")), timeoutMs);
    socket.once("message", (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });

// Start local DNS forwarding server
udpSocket.bind(LOCAL_PORT, LOCAL_HOST, () => {
  console.log(`🚀 DNS Forwarding Server with Failover + TTL Cache running on ${LOCAL_HOST}:${LOCAL_PORT}`);
});

// Handle incoming queries
udpSocket.on("message", async (queryBuffer: Buffer, remoteAddr: dgram.RemoteInfo) => {
  try {
    const parsedHeader = DNSHeader.parse(queryBuffer);
    const { questions } = DNSQuestion.parse(queryBuffer, 12);
    if (questions.length === 0) return;

    const query = questions[0];
    const cacheKey = getCacheKey(query.name, query.type, query.ClassCode);
    const now = Date.now();

    console.log(`📩 Received query for ${cacheKey} from ${remoteAddr.address}:${remoteAddr.port}`);

    // Check cache
    const cached = cache[cacheKey];
    if (cached && cached.expiresAt > now) {
      console.log(`⚡ Cache HIT for ${cacheKey} (TTL remaining: ${(cached.expiresAt - now) / 1000}s)`);
      await sendUDP(udpSocket, cached.buffer, remoteAddr.port, remoteAddr.address);
      return;
    }

    console.log(`🛰️ Cache MISS for ${cacheKey} → trying upstream resolvers...`);

    //  Try upstream resolvers in order
    let response: Buffer | null = null;
    for (const upstream of UPSTREAMS) {
      console.log(`🌐 Trying ${upstream.name} (${upstream.host}:${upstream.port})`);
      try {
        await sendUDP(upstreamSocket, queryBuffer, upstream.port, upstream.host);
        response = await waitForMessage(upstreamSocket, 1500); // 1.5s timeout
        console.log(`✅ Response received from ${upstream.name}`);
        break;
      } catch (err) {
        console.warn(`⚠️ ${upstream.name} failed (${(err as Error).message})`);
      }
    }

    // If all resolvers failed
    if (!response) {
      console.error(`❌ All upstream resolvers failed for ${cacheKey}`);
      return;
    }

    // Parse upstream response for logging
    const header = DNSHeader.parse(response);
    const { questions, bytesRead } = DNSQuestion.parse(response, 12);
    const { answers } = DNSAnswer.parse(response, 12 + bytesRead);

    console.log("📬 Upstream Header:", header);
    console.log("💡 Answers:", answers);

    // Cache response with TTL
    let ttl = 60;
    if (answers.length > 0 && answers[0].ttl) ttl = answers[0].ttl;
    cache[cacheKey] = { buffer: response, expiresAt: now + ttl * 1000 };
    console.log(`💾 Cached ${cacheKey} for ${ttl}s`);

    // Send response to client
    await sendUDP(udpSocket, response, remoteAddr.port, remoteAddr.address);
    console.log(`✅ Forwarded response for ${cacheKey} to ${remoteAddr.address}:${remoteAddr.port}\n`);
  } catch (err) {
    console.error("❌ Error processing DNS request:", err);
  }
});

// Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Object.entries(cache)) {
    if (entry.expiresAt < now) {
      delete cache[key];
      console.log(`🧹 Expired cache entry for ${key}`);
    }
  }
}, 60_000);

//  Error handling
udpSocket.on("error", (err) => {
  console.error("💥 Local server error:", err);
  udpSocket.close();
});

upstreamSocket.on("error", (err) => {
  console.error("💥 Upstream socket error:", err);
  upstreamSocket.close();
});
