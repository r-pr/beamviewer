import React, { RefObject } from "react";
import CloseButton from "../CloseButton";
import { translateErrCode } from "../errors";
import { Settings } from "../settings";
import { SigServerClient } from "../sig-server-client";
import Spinner from "../Spinner";

interface IProps {
    sessId: string;
    nickName: string;
    onExit: (e?: Error) => void;
}

interface IState {
    startedReceiving: boolean;
}

export default class SubScreen extends React.Component<IProps, IState> {

    private videoRef: RefObject<HTMLVideoElement>;
    private sigServer: SigServerClient;
    private rtcConnection: RTCPeerConnection | null = null;
    private aspectRatio: number = 1;

    constructor(p: IProps) {
        super(p);
        this.state = {
            startedReceiving: false
        };
        this.videoRef = React.createRef<HTMLVideoElement>();
        this.exitOk = this.exitOk.bind(this);
        this.sigServer = new SigServerClient(Settings.WS_SRV_URL);
        setInterval(() => this.adjustVideoRefDimensions(), 3000);
    }

    public componentDidMount() {
        const nickname = this.props.nickName;
        (async () => {
            await this.sigServer.connect();
            const iceServers = await SigServerClient.getIceServers();
            const rtcConnection = new RTCPeerConnection({iceServers});
            this.rtcConnection = rtcConnection;
            rtcConnection.oniceconnectionstatechange  = (e) => {
                if (rtcConnection.iceConnectionState === "disconnected") {
                    rtcConnection.close();
                    this.sigServer.close();
                    this.props.onExit(new Error("Peer connection was closed"));
                }
            };
            rtcConnection.ontrack = (e) => {
                if (this.videoRef.current && e.streams.length) {
                    const stream = e.streams[0];
                    this.videoRef.current.srcObject = stream;
                    this.adjustVideoRefDimensions();
                    this.setState({startedReceiving: true});
                    document.title = 'BeamViewer (ID ' + this.props.sessId + ')'
                } else {
                    throw new Error("sth went wrong");
                }
            };

            rtcConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.sigServer.send({
                        type: "candidate",
                        candidate: event.candidate,
                        nickname,
                    });
                }
            };

            this.sigServer.onOffer = (offer: RTCSessionDescriptionInit) => {
                try {
                    rtcConnection.setRemoteDescription(new RTCSessionDescription(offer));
                    rtcConnection.createAnswer().then((answer) => {
                        rtcConnection.setLocalDescription(answer);
                        this.sigServer.send({
                            type: "answer",
                            answer,
                            nickname,
                        });
                    }, (error) => {
                        console.error(error);
                    });
                } catch (e) {
                    console.error(e);
                }

            };

            this.sigServer.onCandidate = (cand: RTCIceCandidateInit) => {
                try {
                    rtcConnection.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                    console.warn(e.message);
                    console.log("candidate:", cand);
                }
            };

            try {
                this.aspectRatio = await this.sigServer.join(this.props.sessId, nickname) as number;
                console.log("ASPECT RATIO: " + this.aspectRatio);
            } catch (e) {
                console.warn(e);
                this.props.onExit(new Error(
                    translateErrCode(e.message),
                ));
            }
        })();
    }

    public render() {
        return (
            <div style ={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100vh',
                overflow: 'hidden',
                backgroundColor: 'white',
                textAlign: 'center',
                margin: 0,
            }}>
                <video ref={this.videoRef} autoPlay={true}/>
                {this.state.startedReceiving ? <div></div> : <Spinner/>}
                <CloseButton onExit={this.exitOk}/>
            </div>
        );
    }

    private getWindowAspectRatio(): number {
        return window.innerWidth / window.innerHeight;
    }

    private adjustVideoRefDimensions(): void {
        if (this.videoRef.current) {
            if (this.getWindowAspectRatio() > this.aspectRatio) {
                this.videoRef.current.style.height = "100vh";
                this.videoRef.current.style.width = "auto";
            } else {
                this.videoRef.current.style.height = "auto";
                this.videoRef.current.style.width = "100%";
            }
        }
        setTimeout(() => {
            if (this.videoRef.current) {
                this.videoRef.current.style.border = "1px solid gray";
            }
        }, 1000);
    }

    private exitOk() {
        if (this.rtcConnection) {
            this.rtcConnection.close();
        }
        this.sigServer.close();
        this.props.onExit();
    }
}
