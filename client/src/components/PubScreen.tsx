import React, { RefObject } from "react";

import { IObj, StreamState_t } from "../interfaces";
import { PublisherConnection } from "../rtc-connection";
import { Settings } from "../settings";
import { SigServerClient } from "../sig-server-client";
import Spinner from "../Spinner";
import { UserMedia } from "../user-media";
import { PubScreenControls } from "./PubScreenControls";

const { MAIN_DIV_CLASS } = Settings;

interface IState {
    sessId: string;
    error: string;
    loading: boolean;
    connectedPeersCount: number;
    streamState: StreamState_t;
}

interface IProps {
    withAudio: boolean;
    onExit: () => void;
}

let tmpConn: any = null;

let candidatesBuff: IObj[] = [];
let offerSent: boolean = false;

const peerConnections: any[] = [];

function closeAllConnections() {
    if (tmpConn && tmpConn.close) {
        tmpConn.close();
    }
    peerConnections.forEach((conn) => {
        if (conn && conn.close) {
            conn.close();
        }
    });
}

export default class PubScreen extends React.Component<IProps, IState> {

    private videoRef: RefObject<HTMLVideoElement>;
    private userMedia: UserMedia;
    private stream: MediaStream | null;
    private sigServer: SigServerClient = new SigServerClient(Settings.WS_SRV_URL);

    constructor(props: IProps) {
        super(props);
        this.state = {
            streamState: "unborn",
            sessId: "",
            error: "",
            loading: true,
            connectedPeersCount: 0,
        };
        this.videoRef = React.createRef<HTMLVideoElement>();
        this.userMedia = new UserMedia();
        this.copySessIdToClipboard = this.copySessIdToClipboard.bind(this);
        this.stream = null;
        this.onPause = this.onPause.bind(this);
        this.onResume = this.onResume.bind(this);
        this.onStop = this.onStop.bind(this);
    }

    public componentDidMount() {
        if (this.userMedia.isBrowserOld()) {
            this.setState({error: "you have an old browser, go get a newer one"});
            return;
        }
        (async () => {
            try {
                const sigServer = this.sigServer;
                const iceServers = await SigServerClient.getIceServers();
                const createTmpConn = (stream: MediaStream) => {
                    candidatesBuff = [];
                    const pubConn = new PublisherConnection(stream, iceServers);
                    pubConn.on("candidate", (candidate) => {
                        if (offerSent) {
                            sigServer.send({
                                type: "candidate",
                                candidate
                            });
                            console.log(pubConn.internalId, "candidate sent");
                        } else {
                            console.log(pubConn.internalId, "candidate buffered");
                            candidatesBuff.push(candidate);
                        }
                    });
                    if (tmpConn !== null) {
                        peerConnections.push(tmpConn);
                    }
                    tmpConn = pubConn.getRtcConnection();
                    pubConn.once("connected", () => this.incrementPeersCount());
                    pubConn.once("disconnected", () => {
                        this.decrementPeersCount();
                        // todo: remove connection from array
                    });
                };

                const sendOffer = (off: any) => {
                    sigServer.send({
                        type: "offer",
                        offer: off,
                    });
                    offerSent = true;
                    if (candidatesBuff.length) {
                        candidatesBuff.forEach((cand) => {
                            sigServer.send({
                                type: "candidate",
                                candidate: cand,
                            });
                        });
                    }
                };

                const sessId = sigServer.getSessId();

                const videoStream = await this.userMedia.getDisplayMedia();

                if (this.props.withAudio) {
                    const audioStream = await this.userMedia.getAudioStream();
                    audioStream.getAudioTracks().forEach((track) => {
                        videoStream.addTrack(track);
                    });
                }

                this.stream = videoStream;

                const aspectRatio = getStreamAspectRatio(videoStream);

                await sigServer.connect();
                await sigServer.logIn({sessionId: sessId, aspectRatio });

                if (this.videoRef.current) {
                    this.videoRef.current.srcObject = videoStream;
                }

                this.setState({streamState: "active"});

                createTmpConn(videoStream);

                const offer = await tmpConn.createOffer();

                tmpConn.setLocalDescription(offer);

                sigServer.onAnswer = (answer: any) => {
                    tmpConn.setRemoteDescription(new RTCSessionDescription(answer));
                    (async () => {
                        console.log("creating new peer connection...");
                        createTmpConn(videoStream);
                        const newOffer = await tmpConn.createOffer();
                        tmpConn.setLocalDescription(newOffer);
                        sendOffer(newOffer);
                    })();
                };

                sendOffer(offer);

                this.setState({sessId, loading: false});
            } catch (e) {
                console.error(e);
                this.setState({error: e.message});
            }
        })();

    }

    public render() {
        return (
            <div className="row">
                <div className={MAIN_DIV_CLASS}>
                    <video
                        ref={this.videoRef}
                        autoPlay={true}
                        style={{
                            width: "100%",
                            display: this.state.loading ? "none" : "block",
                            border: "1px solid darkgray",
                            borderRadius: "0.5em",
                        }}
                    />
                    {this.getActiveElement()}
                </div>
            </div>
        );
    }

    private incrementPeersCount() {
        this.setState({connectedPeersCount: this.state.connectedPeersCount + 1});
    }

    private decrementPeersCount() {
        this.setState({connectedPeersCount: this.state.connectedPeersCount - 1});
    }

    private copySessIdToClipboard() {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(this.state.sessId);
        }
    }

    private getActiveElement(): JSX.Element {
        if (this.state.error) {
            return (
                <div className="alert alert-danger" role="alert">
                    {this.state.error}
                </div>
            );
        } else {
            if (this.state.loading) {
                return <Spinner/>;
            } else {
                return (
                    <React.Fragment>
                        <h5 style={{marginTop: "2em"}}>
                            Session ID:  <b>{this.state.sessId}</b>
                            &nbsp;&nbsp;
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={this.copySessIdToClipboard}
                            >
                                Copy
                            </button>
                        </h5>
                        <h5 style={{marginTop: "1em"}}>
                            Connected peers: {this.state.connectedPeersCount}
                        </h5>

                        <PubScreenControls
                            onPause={this.onPause}
                            onResume={this.onResume}
                            onStop={this.onStop}
                            streamState={this.state.streamState}
                        />

                    </React.Fragment>
                );
            }
        }
    }

    private onStop() {
        this.setState({streamState: "stopped"}, () => {
            closeAllConnections();
            this.sigServer.close();
            this.props.onExit();
            if (this.stream) {
                this.stream.getTracks().forEach((track) =>  track.stop());
            }
        });
    }

    private onPause() {
        if (this.stream) {
            this.setState({streamState: "paused"});
            this.stream.getTracks().forEach((track) => {
                track.enabled = false;
            });
        }
    }

    private onResume() {
        if (this.stream) {
            this.setState({streamState: "active"});
            this.stream.getTracks().forEach((track) => {
                track.enabled = true;
            });
        }
    }

}

function getStreamAspectRatio(stream: MediaStream): number {
    let aspectRatio = 0;
    stream.getVideoTracks().forEach((track) => {
        const trackSettings = track.getSettings();
        if (trackSettings.aspectRatio) {
            aspectRatio = trackSettings.aspectRatio;
            return;
        }
        if (trackSettings.width && trackSettings.height) {
            aspectRatio = trackSettings.width / trackSettings.height;
        }
    });
    return aspectRatio;
}
