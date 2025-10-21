import * as dgram from "dgram";

// Create UDP socket
const udpSocket: dgram.Socket = dgram.createSocket("udp4");

// Bind to localhost:2053
udpSocket.bind(2053, "127.0.0.1", () => {
    console.log("✅ DNS UDP server running on 127.0.0.1:2053");
});

udpSocket.on("message", (data: Buffer, remoteAddr: dgram.RemoteInfo) => {
    try {
        console.log(`📩 Received data from ${remoteAddr.address}:${remoteAddr.port}`);

        // --- Build a 12-byte DNS response header ---
        const response = Buffer.alloc(12);

        // 1️⃣ Packet Identifier (ID): echo back the same ID as query
        const queryId = data.readUInt16BE(0);
        response.writeUInt16BE(queryId, 0);
        // or fix it: response.writeUInt16BE(1234, 0);

        // 2️⃣ Flags (set QR=1, all others 0)
        // bit layout: QR(1) OPCODE(4) AA(1) TC(1) RD(1) RA(1) Z(3) RCODE(4)
        let flags = 0;
        flags |= 1 << 15; // QR = 1 (response)
        response.writeUInt16BE(flags, 2);

        // 3️⃣ QDCOUNT (number of questions)
        response.writeUInt16BE(0, 4);

        // 4️⃣ ANCOUNT (number of answers)
        response.writeUInt16BE(0, 6);

        // 5️⃣ NSCOUNT (authority records)
        response.writeUInt16BE(0, 8);

        // 6️⃣ ARCOUNT (additional records)
        response.writeUInt16BE(0, 10);

        // --- Send 12-byte header-only response ---
        udpSocket.send(response, remoteAddr.port, remoteAddr.address, (err) => {
            if (err) {
                console.error(`❌ Error sending response: ${err}`);
            } else {
                console.log(`📤 Sent 12-byte DNS response to ${remoteAddr.address}:${remoteAddr.port}`);
            }
        });
    } catch (e) {
        console.error(`⚠️ Error processing message: ${e}`);
    }
});

udpSocket.on("error", (err) => {
    console.error(`Server error:\n${err.stack}`);
    udpSocket.close();
});
