import * as http from "http";
import * as path from "path";

import express from "express";
import WebSocket from "ws";

import getIceServers from "./get-ice-servers";
import { IConn, IConnCandAndOffer, IMap, IObj } from "./interfaces";
import { DbLayer} from "./db-layer";

const port = process.env.PORT || 3322;

const app = express();

const dbLayer = new DbLayer();

// to tell typescript not to use DOM typings
export {};

// setting up http server
app.use(express.static(path.join(__dirname, "..", "..", "client", "build") ));

app.get("/ice_servers", (req, resp) => {
    // this serves as service usage statistics.
    // displaying it will be done later.
    dbLayer.saveIceServersRequest();
    getIceServers((err, list) => {
        resp.header("Access-Control-Allow-Origin", "*");
        if (err) {
            console.log(err.message);
            resp.status(500);
            resp.json({error: true});
        } else {
            resp.json({iceServers: list});
        }
    });
});

app.get("*", (req, res: express.Response) => res.send("hello from Beamviewer"));

const httpServer = http.createServer(app);

// setting up ws server

const wsServer = new WebSocket.Server({ server: httpServer });

// id -> conn
const wsConnections: IMap<IConn> = {};

// КОСТЫЛЬ!
// conn_id -> { candiates: arr, timeLastAdd: timestamp, offer: obj}
const bufferedCandidatesAndOffers: IMap<IConnCandAndOffer> = {};

function wsSendJson(json: IObj, conn: IConn) {
    const msg = JSON.stringify(json);
    if (conn.readyState !== 1) {
        console.error(`cannot send ${msg}: conn not open. readyState=${conn.readyState}` +
            `. __type=${conn.__type}. __sessId=${conn.__sessId}`);
    }
    conn.send(msg);
}

function handleLogin(msg: IObj, conn: IConn) {
    if (!msg.sess_id || typeof wsConnections[msg.sess_id] !== "undefined") {
        wsSendJson({type: "login_resp", status: "error", error: "EEXIST"}, conn);
        return;
    }
    conn.__type = "publisher";
    conn.__sessId = msg.sess_id;
    conn.__aspectRatio = msg.aspect_ratio;
    conn.__candidates = [];
    wsConnections[msg.sess_id] = conn;
    wsSendJson({type: "login_resp", status: "ok"}, conn);
    console.log("login: ok: sess_id: " + msg.sess_id);
}

function handleOffer(msg: IObj, conn: IConn) {
    conn.__offer = msg.offer;
    saveOfferToBuffer(conn.__sessId, msg.offer);
    console.log("associated offer with sess_id=" + conn.__sessId);
    if (conn.__type === "publisher") {
        conn.__candidates = [];
        // delete bufferedCandidates[conn.__sessId];
        console.log("handleOffer::cleared candidates");
    }
}

// temp: to save candidates b/w reconnects
function pushCandidateToBuffer(sessId: string, candidate: IObj) {
    if (typeof bufferedCandidatesAndOffers[sessId] === "undefined") {
        bufferedCandidatesAndOffers[sessId] = {
            candidates: [],
            timeLastAdd: 0,
        };
    }
    bufferedCandidatesAndOffers[sessId].candidates.push(candidate);
    bufferedCandidatesAndOffers[sessId].timeLastAdd = Date.now();
}

function saveOfferToBuffer(sessId: string, offer: IObj) {
    if (typeof bufferedCandidatesAndOffers[sessId] === "undefined") {
        bufferedCandidatesAndOffers[sessId] = {
            candidates: [],
            timeLastAdd: 0,
        };
    }
    bufferedCandidatesAndOffers[sessId].offer = offer;
    bufferedCandidatesAndOffers[sessId].timeLastAdd = Date.now();
}

function getOfferFromBuffer(sessId: string): IObj | undefined {
    if (typeof bufferedCandidatesAndOffers[sessId] === "undefined") {
        return undefined;
    }
    return bufferedCandidatesAndOffers[sessId].offer;
}

function getCandidatesFromBuffer(sessId: string) {
    if (typeof bufferedCandidatesAndOffers[sessId] === "undefined") {
        return [];
    }
    return bufferedCandidatesAndOffers[sessId].candidates;
}

setInterval(() => {
    const timeThreshold = 1000 * 60 * 60 * 6; // 6 hours
    const now = Date.now();
    Object.keys(bufferedCandidatesAndOffers).forEach((sessId) => {
        if (now - bufferedCandidatesAndOffers[sessId].timeLastAdd > timeThreshold) {
            // old session
            delete bufferedCandidatesAndOffers[sessId];
        }
    });
}, 1000 * 60 * 60);

function handleCandidate(msg: IObj, conn: IConn) {
    if (conn.__type === "publisher") {
        conn.__candidates.push(msg.candidate);
        pushCandidateToBuffer(conn.__sessId, msg.candidate);
        console.log('handled publisher"s candidate');
    } else if (conn.__type === "subscriber") {
        if (conn.__publisher) {
            wsSendJson(msg, conn.__publisher);
            console.log("candidate from sub sent to pub");
        } else {
            console.error("handleCandidate: subscriber has no publisher");
        }
    } else {
        console.log("err: candidate from wrong connection");
    }
}

function handleAnswer(msg: IObj, conn: IConn) {
    if (conn.__type === "publisher") {
        console.error("handleAnswer: error: answer from publisher");
    } else if (conn.__type === "subscriber") {
        if (conn.__publisher) {
            wsSendJson(msg, conn.__publisher);
            console.log("answer from sub sent to pub");
        } else {
            console.error("handleAnswer: subscriber has no publisher");
        }
    }
}

function handleJoin(msg: IObj, conn: IConn) {
    const publisherConn = wsConnections[msg.sess_id];
    if (typeof publisherConn === "undefined") {
        wsSendJson({type: "join_resp", status: "error", error: "ENOTFOUND"}, conn);
        return;
    }
    let offer: IObj | undefined = publisherConn.__offer;
    if (!offer) {
        offer = getOfferFromBuffer(publisherConn.__sessId);
    }
    if (!offer) {
        wsSendJson({type: "join_resp", status: "error", error: "ENOOFF"}, conn);
        return;
    }
    let candidates;
    if (!publisherConn.__candidates || !publisherConn.__candidates.length) {
        const bufCands = getCandidatesFromBuffer(publisherConn.__sessId);
        if (bufCands.length > 0) {
            candidates = bufCands;
        } else {
            console.log("---test cand---");
            console.log(JSON.stringify(bufCands, null, " "));
            console.log(JSON.stringify(bufCands.length));
            console.log(JSON.stringify(publisherConn.__candidates));
            wsSendJson({type: "join_resp", status: "error", error: "ENOCAND"}, conn);
            return;
        }
    } else {
        candidates = publisherConn.__candidates;
    }
    const nick = msg.nickname || "anonymous";
    if (!publisherConn.__subscribers) {
        publisherConn.__subscribers = [];
    }
    for (const sub of publisherConn.__subscribers) {
        if (sub.__nick === nick) {
            wsSendJson({type: "join_resp", status: "error", error: "ENICK"}, conn);
            return;
        }
    }
    conn.__type = "subscriber";
    conn.__nick = nick;
    conn.__publisher = publisherConn;
    publisherConn.__subscribers.push(conn);
    wsSendJson({
        aspectRatio: publisherConn.__aspectRatio,
        status: "ok",
        type: "join_resp",
    }, conn);
    wsSendJson({type: "offer", offer}, conn);
    candidates.forEach((cand) => {
        wsSendJson({type: "candidate", candidate: cand}, conn);
    });
}

function handleDisconnect(conn: IConn) {
    if (conn.__type === "publisher") {
        console.log("publisher disconnected");
        if (conn.__subscribers) {
            conn.__subscribers.forEach((subs) => {
                try {
                    subs.close();
                } catch (e) {
                    console.error(e);
                }
            });
        }
        delete wsConnections[conn.__sessId];
    } else if (conn.__type === "subscriber") {
        console.log("subscriber disconnected");
        if (conn.__publisher) {
            if (conn.__publisher.__subscribers) {
                conn.__publisher.__subscribers = conn.__publisher.__subscribers.filter((sub) => {
                    return sub.__nick !== conn.__nick;
                });
            }
        }
    } else {
        console.log("connection without type closed");
    }
}

wsServer.on("connection", function connection(ws) {
    console.log("conn opened");

    ws.on("message", function incoming(message) {
        message = message + "";
        const logMessage = message.length > 80 ? message.slice(0, 80) : message;
        console.log("> " + logMessage);
        let json: IObj = {};
        try {
            json = JSON.parse(message);
        } catch (e) {
            console.error(e.message);
            return;
        }
        switch (json.type) {
        case "login":
            handleLogin(json, ws as IConn);
            break;
        case "offer":
            handleOffer(json, ws as IConn);
            break;
        case "candidate":
            handleCandidate(json, ws as IConn);
            break;
        case "join":
            handleJoin(json, ws as IConn);
            break;
        case "answer":
            handleAnswer(json, ws as IConn);
            break;
        default:
            console.log("unknown msg");
        }
    });

    ws.on("close", () => {
        console.log("conn closed");
        handleDisconnect(ws as IConn);
    });
});

// starting
httpServer.listen(port, () => console.log(`server listening on port ${port}`));
