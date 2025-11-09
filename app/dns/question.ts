import { DNSClass, DNSType } from './types.ts';

export type TDNSQuestion = {
  name: string;
  type: DNSType;
  ClassCode: DNSClass;
};

export default class DNSQuestion {
  /**
   * ✅ Parse DNS Question section (handles compression)
   */
  static parse(buffer: Buffer, offset: number = 12): { questions: TDNSQuestion[]; bytesRead: number } {
    const questions: TDNSQuestion[] = [];

    // Parse the domain name (supports compression)
    const { name, bytesRead: nameLength } = this.readDomainName(buffer, offset);
    let currentOffset = offset + nameLength;

    // Parse Type and Class (4 bytes)
    const type = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    const ClassCode = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    questions.push({ name, type, ClassCode });

    return { questions, bytesRead: currentOffset - offset };
  }

  /**
   * ✅ Reads a domain name from a DNS message
   * Supports normal labels and compression (0xC0 pointers)
   */
  static readDomainName(buffer: Buffer, offset: number): { name: string; bytesRead: number } {
    const labels: string[] = [];
    let jumped = false;
    let originalOffset = offset;
    let bytesRead = 0;

    while (true) {
      const length = buffer[offset++];

      // Terminating null byte (end of domain)
      if (length === 0) {
        if (!jumped) bytesRead++;
        break;
      }

      // Check for compression pointer (first two bits 11 -> 0xC0)
      if ((length & 0xC0) === 0xC0) {
        // Compute pointer location
        const pointer = ((length & 0x3F) << 8) | buffer[offset++];
        if (!jumped) bytesRead += 2; // count only first pointer bytes

        // Recursively read the pointed domain
        const { name: pointedName } = this.readDomainName(buffer, pointer);
        labels.push(pointedName);
        break;
      } else {
        // Normal label (read `length` bytes)
        const label = buffer.slice(offset, offset + length).toString('utf8');
        labels.push(label);
        offset += length;

        if (!jumped) bytesRead += length + 1;
      }
    }

    return { name: labels.join('.'), bytesRead };
  }

  /**
   * ✅ Write DNS Question section (no compression used when writing)
   */
  static write(questions: TDNSQuestion[]): Buffer {
    const buffers: Buffer[] = [];

    for (const q of questions) {
      // Convert domain name to DNS wire format
      const nameParts = q.name.split('.');
      for (const part of nameParts) {
        buffers.push(Buffer.from([part.length]));
        buffers.push(Buffer.from(part));
      }
      buffers.push(Buffer.from([0])); // null terminator

      // Add Type and Class (4 bytes)
      const typeClass = Buffer.alloc(4);
      typeClass.writeUInt16BE(q.type, 0);
      typeClass.writeUInt16BE(q.ClassCode, 2);
      buffers.push(typeClass);
    }

    return Buffer.concat(buffers);
  }
}
