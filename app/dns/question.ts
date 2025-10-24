import { DNSClass, DNSQuestionType } from './types';

export type TDNSQuestion = {
    name: string;
    type: DNSQuestionType;
    ClassCode: DNSClass;
};

export default class DNSQuestion {
    static write(questions: TDNSQuestion[]): Buffer {
        const buffers: Buffer[] = [];
        
        for (const q of questions) {
            // Convert domain name to DNS format
            const nameParts = q.name.split('.');
            for (const part of nameParts) {
                buffers.push(Buffer.from([part.length]));
                buffers.push(Buffer.from(part));
            }
            buffers.push(Buffer.from([0])); // terminating byte

            // Add type and class
            const typeClass = Buffer.alloc(4);
            typeClass.writeUInt16BE(q.type, 0);
            typeClass.writeUInt16BE(q.ClassCode, 2);
            buffers.push(typeClass);
        }

        return Buffer.concat(buffers);
    }
}