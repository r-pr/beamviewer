import WebSocket from "ws";

export interface IObj {
    [key: string]: any;
}

export interface IConn extends WebSocket {
    __type: string;
    __sessId: string;
    __candidates: IObj[];
    __offer: IObj;
    __publisher?: IConn;
    __subscribers: IConn[];
    __nick: string;
    __aspectRatio: number;
}

export interface IMap<T> {
    [key: string]: T;
}

export interface IConnCandAndOffer {
    candidates: IObj[];
    offer?: IObj;
    timeLastAdd: number;
}
