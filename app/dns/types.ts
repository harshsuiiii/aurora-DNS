export enum OPCODE {
    STANDARD_QUERY = 0,
    INVERSE_QUERY = 1,
    SERVER_STATUS = 2
}

export enum ResponseCode {
    NO_ERROR = 0,
    FORMAT_ERROR = 1,
    SERVER_FAILURE = 2,
    NAME_ERROR = 3,
    NOT_IMPLEMENTED = 4,
    REFUSED = 5
}

export enum DNSClass {
    IN = 1,
    CS = 2,
    CH = 3,
    HS = 4
}

export enum DNSQuestionType {
    A = 1,
    NS = 2,
    CNAME = 5,
    MX = 15
}
