import * as dgram from "dgram";
import DNSHeader, { TDNSHeader } from "./dns/header";
import DNSQuestion, { TDNSQuestion } from "./dns/question";
import { OPCODE, ResponseCode, DNSClass, DNSQuestionType } from "./dns/types";

const defaultheader: TDNSHeader = {
    id: 1234,
    qr: 1 << 15,
    opcode: OPCODE.STANDARD_QUERY,
    aa: 0,
    tc: 0,
    rd: 0,
    ra: 0,
    z: 0,
    rcode: ResponseCode.NO_ERROR,
    qdcount: 0,
    ancount: 0,
    nscount: 0,
    arcount: 0,
};

const defaultQuestion = {
    name: 'codecrafters.io',
    ClassCode: DNSClass.IN,
    type: DNSQuestionType.A,
};

const udpSocket: dgram.Socket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");


udpSocket.on("message", (data: Buffer, remoteAddr: dgram.RemoteInfo) => {
    try {
        console.log(`Received data from ${remoteAddr.address}:${remoteAddr.port}`);
        const header = DNSHeader.write({...defaultheader, qdcount: 1});
        const question = DNSQuestion.write([defaultQuestion]); 

        const response = Buffer.concat([header, question]);   
        udpSocket.send(response, remoteAddr.port, remoteAddr.address);
    } catch (e) {
        console.log(`Error sending data: ${e}`);
    }
});