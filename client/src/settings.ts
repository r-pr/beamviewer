interface ISettings {
    HTTP_SRV_URL: string;
    WS_SRV_URL: string;
    MAIN_DIV_CLASS: string;
    DEFAULT_ICE_SERVERS: RTCIceServer[];
}

const srvHost = process.env.NODE_ENV === "production" ?
    window.location.host : "localhost:3322";

const wsProtocol = (window.location.protocol === "https:") ? "wss:" : "ws:";

export const Settings: ISettings = {
    HTTP_SRV_URL: `${window.location.protocol}//${srvHost}`,
    WS_SRV_URL: `${wsProtocol}//${srvHost}`,
    MAIN_DIV_CLASS: "col-sm-6 col-md-4 col-lg-4 offset-sm-3 offset-md-4 offset-lg-4",
    DEFAULT_ICE_SERVERS: [{
        urls: "stun:stun.l.google.com:19302",
    }],
};
