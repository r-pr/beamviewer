export interface IUserAppModePub {
    mode: "pub";
    withAudio: boolean;
}

export interface IUserAppModeSub {
    mode: "sub";
    sessionId: string;
    nickName: string;
}

export interface IObj {
    [key: string]: any;
}

export type StreamState_t = "unborn" | "active" | "paused" | "stopped";

export type IUserAppMode = IUserAppModePub | IUserAppModeSub;
