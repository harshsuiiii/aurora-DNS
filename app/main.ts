import * as dgram from "dgram";
import DNSHeader from "./dns/header.ts";
import DNSQuestion from "./dns/question.ts";
import DNSAnswer from "./dns/answer.ts";

const LOCAL_PORT = 2053;
const LOCAL_HOST = "127.0.0.1";

const UPSTREAMS = [
  { host: "8.8.8.8", port: 53, name: "GoogleDNS" },
  { host: "1.1.1.1", port: 53, name: "CloudflareDNS" },
];

const udpSocket: dgram.Socket = dgram.createSocket("udp4");
const upstreamSocket: dgram.Socket = dgram.createSocket("udp4");

// ✅ TTL-aware cache by (name|type|class)
const cache: Record<string, { buffer: Buffer; expiresAt: number }> = {};

// ✅ Utility: Build cache key
const getCacheKey = (name: string, type: number, classCode: number): string =>
  `${name.toLowerCase()}|${type}|${classCode}`;

// ✅ Safe UDP send (with catch)
const sendUDP = async (
  socket: dgram.Socket,
  message: Buffer,
  port: number,
  host: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    socket.send(message, port, host, (err) => {
      if (err) {
        console.error(`❌ UDP send failed to ${host}:${port}`, err);
        reject(err);
      } else resolve();
    });
  });
};

// ✅ Promise-based listener with timeout (safe reject)
const waitForMessage = (socket: dgram.Socket, timeoutMs: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("⏰ Upstream timeout"));
    }, timeoutMs);

    socket.once("message", (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });

// ✅ Start DNS server
udpSocket.bind(LOCAL_PORT, LOCAL_HOST, () => {
  console.log(`🚀 DNS Forwarding Server (Failover + TTL Cache) running on ${LOCAL_HOST}:${LOCAL_PORT}`);
});

udpSocket.on("message", async (queryBuffer: Buffer, remoteAddr: dgram.RemoteInfo) => {
  try {
    const parsedHeader = DNSHeader.parse(queryBuffer);
    const { questions } = DNSQuestion.parse(queryBuffer, 12);
    if (questions.length === 0) return;

    const query = questions[0];
    const cacheKey = getCacheKey(query.name, query.type, query.ClassCode);
    const now = Date.now();

    console.log(`📩 Query for ${cacheKey} from ${remoteAddr.address}:${remoteAddr.port}`);

    // ✅ Check cache
    const cached = cache[cacheKey];
    if (cached && cached.expiresAt > now) {
      console.log(`⚡ Cache HIT (TTL: ${(cached.expiresAt - now) / 1000}s)`);
      await sendUDP(udpSocket, cached.buffer, remoteAddr.port, remoteAddr.address).catch((err) =>
        console.error("❌ Cache send error:", err)
      );
      return;
    }

    console.log(`🛰️ Cache MISS → trying upstream resolvers...`);

    // ✅ Try upstream resolvers
    let response: Buffer | null = null;
    for (const upstream of UPSTREAMS) {
      console.log(`🌐 Trying ${upstream.name} (${upstream.host}:${upstream.port})`);
      try {
        await sendUDP(upstreamSocket, queryBuffer, upstream.port, upstream.host);
        response = await waitForMessage(upstreamSocket, 1500);
        console.log(`✅ Response received from ${upstream.name}`);
        break;
      } catch (err) {
        console.warn(`⚠️ ${upstream.name} failed: ${(err as Error).message}`);
      }
    }

    if (!response) {
      console.error(`❌ All upstream resolvers failed for ${cacheKey}`);
      return;
    }

    // ✅ Parse response for TTL logging
    try {
      const header = DNSHeader.parse(response);
      const { questions, bytesRead } = DNSQuestion.parse(response, 12);
      const { answers } = DNSAnswer.parse(response, 12 + bytesRead);

      let ttl = 60;
      if (answers.length > 0 && answers[0].ttl) ttl = answers[0].ttl;

      cache[cacheKey] = { buffer: response, expiresAt: now + ttl * 1000 };
      console.log(`💾 Cached ${cacheKey} for ${ttl}s`);
    } catch (err) {
      console.error("❌ Failed to parse upstream response:", err);
    }

    await sendUDP(udpSocket, response, remoteAddr.port, remoteAddr.address).catch((err) =>
      console.error("❌ Failed to send response to client:", err)
    );
    console.log(`✅ Response sent for ${cacheKey}\n`);
  } catch (err) {
    console.error("💥 Fatal error processing DNS request:", err);
  }
});

// ✅ Periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Object.entries(cache)) {
    if (entry.expiresAt < now) {
      delete cache[key];
      console.log(`🧹 Expired cache entry for ${key}`);
    }
  }
}, 60_000);

// ✅ Global unhandled rejection handler (final safety net)
process.on("unhandledRejection", (reason) => {
  console.error("💥 Unhandled Promise Rejection:", reason);
});

udpSocket.on("error", (err) => {
  console.error("💥 Local server error:", err);
  udpSocket.close();
});

upstreamSocket.on("error", (err) => {
  console.error("💥 Upstream socket error:", err);
  upstreamSocket.close();
});
