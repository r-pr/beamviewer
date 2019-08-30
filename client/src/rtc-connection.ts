import { EventEmitter } from "events";

let connectionCouner = 1;

export class PublisherConnection extends EventEmitter {

    public readonly internalId: number;
    private rtcConnection: RTCPeerConnection;

    constructor(private stream: MediaStream, private iceServers: RTCIceServer[]) {
        super();
        this.internalId = connectionCouner;
        connectionCouner++;
        this.rtcConnection = new RTCPeerConnection({iceServers});
        (this.rtcConnection as any).addStream(stream);
        this.rtcConnection.onicecandidate = (event: any) => {
            if (event.candidate) {
                this.emit("candidate", event.candidate);
            }
        };
        this.rtcConnection.oniceconnectionstatechange  = () => {
            if (this.rtcConnection.iceConnectionState === "connected") {
                this.emit("connected");
            } else if (this.rtcConnection.iceConnectionState === "disconnected") {
                this.rtcConnection.close();
                this.emit("disconnected");
            }
        };
    }

    public getRtcConnection(): RTCPeerConnection {
        return this.rtcConnection;
    }
}
