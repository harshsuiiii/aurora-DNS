import { OPCODE, ResponseCode } from './types.ts';

export type TDNSHeader = {
  id: number;
  qr: number;
  opcode: OPCODE;
  aa: number;
  tc: number;
  rd: number;
  ra: number;
  z: number;
  rcode: ResponseCode;
  qdcount: number;
  ancount: number;
  nscount: number;
  arcount: number;
};

export default class DNSHeader {
  //  Parse header from received DNS query buffer
  static parse(buffer: Buffer): TDNSHeader {
    const id = buffer.readUInt16BE(0);
    const flags = buffer.readUInt16BE(2);
    return {
      id: buffer.readUInt16BE(0),
      qr: (flags >> 15) & 0x1,
      opcode: (flags >> 11) & 0xf,
      aa: (flags >> 10) & 0x1,
      tc: (flags >> 9) & 0x1,
      rd: (flags >> 8) & 0x1,
      ra: (flags >> 7) & 0x1,
      z: (flags >> 4) & 0x7,
      rcode: flags & 0xf,
      qdcount: buffer.readUInt16BE(4),
      ancount: buffer.readUInt16BE(6),
      nscount: buffer.readUInt16BE(8),
      arcount: buffer.readUInt16BE(10),
    };
  }

  // ✅ Build header for DNS response
  static write(header: TDNSHeader): Buffer {
    const buffer = Buffer.alloc(12);
    buffer.writeUInt16BE(header.id, 0);

    let flags = 0;
    flags |= (header.qr << 15);
    flags |= (header.opcode << 11);
    flags |= (header.aa << 10);
    flags |= (header.tc << 9);
    flags |= (header.rd << 8);
    flags |= (header.ra << 7);
    flags |= (header.z << 4);
    flags |= (header.rcode & 0x0F);
    buffer.writeUInt16BE(flags, 2);

    // Write counts (16 bits each)
    buffer.writeUInt16BE(header.qdcount, 4);
    buffer.writeUInt16BE(header.ancount, 6);
    buffer.writeUInt16BE(header.nscount, 8);
    buffer.writeUInt16BE(header.arcount, 10);

    return buffer;
  }
}
