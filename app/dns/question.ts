export enum DNSQuestionType {
    A = 1,
    NS = 2,
}

export enum DNSClass {
    IN = 1,
     
}

export interface IDNSQuestion {
    qname: string;
    qtype: DNSQuestionType;
    classCode: number;
}

class DNSQuestion {
    static write(values: IDNSQuestion[]){
        return Buffer.concat(
            question.map((question) => {
                const { name, type, classCode } = question;
                const str = name
                    .split('.')
                    .map((part) => `${String.fromCharCode(name.length)}${n}`)
                    .join("");

                    const typeAndClass = ArrayBuffer.alloc(4);
                    typeAndClass.writeUInt16BE(type);
                    typeAndClass.writeUInt16BE(classCode, 2);

                    return Buffer.concat([ArrayBuffer.from(str + "\0", "binary"), typeAndClass]);
            })
        );
    }
}

export default DNSQuestion;