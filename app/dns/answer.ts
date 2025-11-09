import { DNSClass, DNSType } from "./types.ts";
import DNSQuestion from "./question.ts"; // readDomainName()

export interface IDNSAnswer {
  name: string;
  type: DNSType;
  ClassCode: DNSClass;
  ttl: number;
  data: string;
}

export default class DNSAnswer {
  
   // Parse Answer Section (supports compressed names)
  static parse(buffer: Buffer, offset: number): { answers: IDNSAnswer[]; bytesRead: number } {
    const answers: IDNSAnswer[] = [];
    let currentOffset = offset;

    // Parse compressed domain name (uses DNSQuestion.readDomainName)
    const { name, bytesRead: nameLen } = DNSQuestion.readDomainName(buffer, currentOffset);
    currentOffset += nameLen;

    
    const type = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    const ClassCode = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    const ttl = buffer.readUInt32BE(currentOffset);
    currentOffset += 4;

    const dataLength = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    // Read the actual resource data (RDATA)
    const data = buffer.slice(currentOffset, currentOffset + dataLength);
    currentOffset += dataLength;

    // For IPv4 A record, convert data to human-readable IP (optional)
    let readableData: string;
    if (type === DNSType.A && dataLength === 4) {
      readableData = Array.from(data).join(".");
    } else {
      readableData = data.toString("binary");
    }

    answers.push({
      name,
      type,
      ClassCode,
      ttl,
      data: readableData,
    });

    return { answers, bytesRead: currentOffset - offset };
  }

  /**
   * Write DNS Answer Section (no compression used)
   */
  static write(answers: IDNSAnswer[]): Buffer {
    return Buffer.concat(
      answers.map((ans) => {
        const { name, type, ClassCode, ttl, data } = ans;

        // Encode domain name in standard DNS wire format
        const nameParts = name.split(".");
        const nameBuffers: Buffer[] = [];
        for (const part of nameParts) {
          nameBuffers.push(Buffer.from([part.length]));
          nameBuffers.push(Buffer.from(part));
        }
        nameBuffers.push(Buffer.from([0])); // null terminator
        const nameBuffer = Buffer.concat(nameBuffers);

        // Create answer header (10 bytes)
        const headerBuffer = Buffer.alloc(10);
        headerBuffer.writeUInt16BE(type, 0);
        headerBuffer.writeUInt16BE(ClassCode, 2);
        headerBuffer.writeUInt32BE(ttl, 4);

        const dataBuffer =
          type === DNSType.A
            ? Buffer.from(data.split(".").map((x) => parseInt(x))) // convert "8.8.8.8" to bytes
            : Buffer.from(data, "binary");

        headerBuffer.writeUInt16BE(dataBuffer.length, 8);

        return Buffer.concat([nameBuffer, headerBuffer, dataBuffer]);
      })
    );
  }
}
