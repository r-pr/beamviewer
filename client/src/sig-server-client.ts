import axios from "axios";
import { IObj } from "./interfaces";
import { Settings } from "./settings";

// TODO: finish

function generateRandomString(): string {
    const len = 3;
    const numbers = new Uint8Array(len);
    const letters: string[] = [];
    window.crypto.getRandomValues(numbers);
    numbers.forEach( (n) => letters.push(n.toString(10)) );
    return letters.join("").slice(0, 6);
}

function spleep(msec: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, msec);
    });
}

interface ILoginOptions {
    sessionId: string;
    aspectRatio: number;
}

export class SigServerClient {

    public static async getIceServers(): Promise<RTCIceServer[]> {
        const url = `${Settings.HTTP_SRV_URL}/ice_servers`;
        const resp = await axios.get(url);
        if (resp.status !== 200 ||
            !resp.data ||
            !resp.data.iceServers
        ) {
            console.warn("default ice servers");
            return Settings.DEFAULT_ICE_SERVERS;
        }
        return resp.data.iceServers;
    }

    public onCandidate: any;
    public onOffer: any;
    public onAnswer: any;

    private url: string;
    private ws: any;
    private pendingPromise: any;
    private sessId: string;
    private aspectRatio: number;
    private previousReconnectTime: number;
    private closedByUser: boolean;

    constructor(url: string) {
        this.ws = null;
        this.url = url;
        this.pendingPromise = {};
        this.sessId = generateRandomString();
        this.aspectRatio = 0;
        this.previousReconnectTime = 0;
        this.closedByUser = false;
    }

    public getSessId() {
        return this.sessId;
    }

    public connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log("try construct websocket");
                this.ws = new WebSocket(this.url);
                console.log("ws constructed");
            } catch (e) {
                console.log("ws construct:: err");
                reject(e);
                return this.reconnect();
            }

            this.ws.onopen = resolve;
            this.ws.onerror = (ws: WebSocket, ev: Event): any => {
                console.warn("ws::on_error::", ev);
            };
            this.ws.onmessage = this.onMessage.bind(this);
            this.ws.onclose = () => {
                this.ws.onerror = null;
                this.ws.onmessage = null;
                if (this.closedByUser) {
                    return;
                }
                console.log("ws closed, gonna reconnect");
                if (Date.now() - this.previousReconnectTime < 2000) {
                    console.log(`wait 2000 msec before reconnect`);
                    setTimeout(this.reconnect.bind(this), 2000);
                } else {
                    this.reconnect();
                }
            };
        });
    }

    public logIn(opts: ILoginOptions) {
        this.aspectRatio = opts.aspectRatio;
        return new Promise((resolve, reject) => {
            this.pendingPromise = { resolve, reject };
            console.log(`login, sessId=${opts.sessionId} (${typeof opts.sessionId})`);
            const sessId = opts.sessionId ? opts.sessionId : generateRandomString();
            this.send({
                type: "login",
                sess_id: sessId,
                aspect_ratio: opts.aspectRatio
            });
        });
    }

    public join(sessId: string, nickName: string) {
        return new Promise((resolve, reject) => {
            this.pendingPromise = { resolve, reject };
            this.send({
                type: "join",
                sess_id: sessId,
                nickname: nickName,
            });
        });
    }

    public send(obj: IObj) {
        this.ws.send(JSON.stringify(obj));
    }

    public close() {
        this.closedByUser = true;
        if (this.ws) {
            if (this.ws.close) {
                // так должно работать и так работает в опере
                this.ws.close();
            } else if (this.ws.websocket && this.ws.websocket.close) {
                // откуда берется this.ws.websocket - неизвестно
                // но в firefox выполняется именно этот блок
                this.ws.websocket.close();
            }
        }
    }

    private onMessage(msg: any) {
        let json: any = {};
        try {
            json = JSON.parse(msg.data);
        } catch (e) {
            console.warn("ws: " + e.message + ". msg.data=" + msg.data);
            return;
        }
        console.log("ws: ", json);
        switch (json.type) {
        case "login_resp":
            this.handleLoginResp(json);
            break;
        case "candidate":
            this.handleCandidate(json);
            break;
        case "offer":
            this.handleOffer(json);
            break;
        case "answer":
            this.handleAnswer(json);
            break;
        case "join_resp":
            this.handleJoinResp(json);
            break;
        }
    }

    private handleLoginResp(resp: any) {
        if (resp.status === "ok") {
            this.pendingPromise.resolve(this.sessId);
        } else {
            this.pendingPromise.reject(new Error(resp.error));
        }
        this.pendingPromise = {};
    }

    private handleJoinResp(resp: any) {
        if (resp.status === "ok") {
            this.pendingPromise.resolve(resp.aspectRatio);
        } else {
            this.pendingPromise.reject(new Error(resp.error));
        }
        this.pendingPromise = {};
    }

    private handleCandidate(msg: any) {
        console.log(Date.now() + " ws: got candidate");
        if (this.onCandidate && typeof this.onCandidate === "function") {
            this.onCandidate(msg.candidate);
        }
    }

    private handleOffer(msg: any) {
        console.log(Date.now() + " ws: got offer");
        if (!msg.offer) {
            console.warn(".offer is " + msg.offer);
            return;
        }
        if (this.onOffer && typeof this.onOffer === "function") {
            this.onOffer(msg.offer);
        }
    }

    private handleAnswer(msg: any) {
        if (this.onAnswer && typeof this.onAnswer === "function") {
            this.onAnswer(msg.answer);
        } else {
            console.warn("no handler");
        }
    }

    private reconnect() {
        if (this.closedByUser) {
            return;
        }
        this.previousReconnectTime = Date.now();
        this.ws = null;
        const minDelay = 1;
        const maxDelay = 10;
        let delay = minDelay;
        (async () => {
            while (true) {
                try {
                    console.log("try reconnect");
                    await this.connect();
                    break;
                } catch (e) {
                    console.warn(e);
                    if (delay < maxDelay) {
                        delay++;
                    }
                    console.log(`reconnect failed, now sleeping ${delay} sec`);
                    await spleep(delay * 1000);
                }
            }
            console.log("reconnected");
            if (this.sessId) {
                console.log("was logged in before, logging after reconnect");
                await this.logIn({
                    sessionId: this.sessId,
                    aspectRatio: this.aspectRatio
                });
                console.log("login after reconnect: ok");
            }
        })();
    }
}
