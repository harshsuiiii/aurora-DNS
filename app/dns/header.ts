export enum OPCODE {
    STANDARD_QUERY = 0,
}

export enum ResponseCode {
    NO_ERROR = 0,
    FORMAT_ERROR = 1,
    SERVER_FAILURE = 2,
    NAME_ERROR = 3,
    NOT_IMPLEMENTED = 4,
    REFUSED = 5,
}


export interface TDNSHeader {
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
}

class DNSHeader {
    static write(values: TDNSHeader) {
        const header = Buffer.alloc(12);

        header.writeUInt32BE(values.id, 0);

        const flags =
            values.qr |
            values.opcode |
            values.aa |
            values.tc |
            values.tc |
            values.rd |
            values.ra |
            values.z |
            values.rcode;

        header.writeUInt32BE(values.id, 0);
        header.writeUInt32BE(flags, 2);
        header.writeUInt32BE(values.qdcount, 4);
        header.writeUInt32BE(values.ancount, 6);
        header.writeUInt32BE(values.nscount, 8);
        header.writeUInt32BE(values.arcount, 10);

        return header;
    }
}

export default DNSHeader;