"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var http = __importStar(require("http"));
var path = __importStar(require("path"));
var express_1 = __importDefault(require("express"));
var ws_1 = __importDefault(require("ws"));
var get_ice_servers_1 = __importDefault(require("./get-ice-servers"));
var port = process.env.PORT || 3322;
var app = express_1["default"]();
app.use(express_1["default"].static(path.join(__dirname, "..", "..", "client", "build")));
app.get("/ice_servers", function (req, resp) {
    get_ice_servers_1["default"](function (err, list) {
        resp.header("Access-Control-Allow-Origin", "*");
        if (err) {
            console.log(err.message);
            resp.status(500);
            resp.json({ error: true });
        }
        else {
            resp.json({ iceServers: list });
        }
    });
});
app.get("*", function (req, res) { return res.send("hello from Beamviewer"); });
var httpServer = http.createServer(app);
var wsServer = new ws_1["default"].Server({ server: httpServer });
var wsConnections = {};
var bufferedCandidatesAndOffers = {};
function wsSendJson(json, conn) {
    var msg = JSON.stringify(json);
    if (conn.readyState !== 1) {
        console.error("cannot send " + msg + ": conn not open. readyState=" + conn.readyState +
            (". __type=" + conn.__type + ". __sessId=" + conn.__sessId));
    }
    conn.send(msg);
}
function handleLogin(msg, conn) {
    if (!msg.sess_id || typeof wsConnections[msg.sess_id] !== "undefined") {
        wsSendJson({ type: "login_resp", status: "error", error: "EEXIST" }, conn);
        return;
    }
    conn.__type = "publisher";
    conn.__sessId = msg.sess_id;
    conn.__aspectRatio = msg.aspect_ratio;
    conn.__candidates = [];
    wsConnections[msg.sess_id] = conn;
    wsSendJson({ type: "login_resp", status: "ok" }, conn);
    console.log("login: ok: sess_id: " + msg.sess_id);
}
function handleOffer(msg, conn) {
    conn.__offer = msg.offer;
    saveOfferToBuffer(conn.__sessId, msg.offer);
    console.log("associated offer with sess_id=" + conn.__sessId);
    if (conn.__type === "publisher") {
        conn.__candidates = [];
        console.log("handleOffer::cleared candidates");
    }
}
function pushCandidateToBuffer(sessId, candidate) {
    if (typeof bufferedCandidatesAndOffers[sessId] === "undefined") {
        bufferedCandidatesAndOffers[sessId] = {
            candidates: [],
            timeLastAdd: 0
        };
    }
    bufferedCandidatesAndOffers[sessId].candidates.push(candidate);
    bufferedCandidatesAndOffers[sessId].timeLastAdd = Date.now();
}
function saveOfferToBuffer(sessId, offer) {
    if (typeof bufferedCandidatesAndOffers[sessId] === "undefined") {
        bufferedCandidatesAndOffers[sessId] = {
            candidates: [],
            timeLastAdd: 0
        };
    }
    bufferedCandidatesAndOffers[sessId].offer = offer;
    bufferedCandidatesAndOffers[sessId].timeLastAdd = Date.now();
}
function getOfferFromBuffer(sessId) {
    if (typeof bufferedCandidatesAndOffers[sessId] === "undefined") {
        return undefined;
    }
    return bufferedCandidatesAndOffers[sessId].offer;
}
function getCandidatesFromBuffer(sessId) {
    if (typeof bufferedCandidatesAndOffers[sessId] === "undefined") {
        return [];
    }
    return bufferedCandidatesAndOffers[sessId].candidates;
}
setInterval(function () {
    var timeThreshold = 1000 * 60 * 60 * 6;
    var now = Date.now();
    Object.keys(bufferedCandidatesAndOffers).forEach(function (sessId) {
        if (now - bufferedCandidatesAndOffers[sessId].timeLastAdd > timeThreshold) {
            delete bufferedCandidatesAndOffers[sessId];
        }
    });
}, 1000 * 60 * 60);
function handleCandidate(msg, conn) {
    if (conn.__type === "publisher") {
        conn.__candidates.push(msg.candidate);
        pushCandidateToBuffer(conn.__sessId, msg.candidate);
        console.log('handled publisher"s candidate');
    }
    else if (conn.__type === "subscriber") {
        if (conn.__publisher) {
            wsSendJson(msg, conn.__publisher);
            console.log("candidate from sub sent to pub");
        }
        else {
            console.error("handleCandidate: subscriber has no publisher");
        }
    }
    else {
        console.log("err: candidate from wrong connection");
    }
}
function handleAnswer(msg, conn) {
    if (conn.__type === "publisher") {
        console.error("handleAnswer: error: answer from publisher");
    }
    else if (conn.__type === "subscriber") {
        if (conn.__publisher) {
            wsSendJson(msg, conn.__publisher);
            console.log("answer from sub sent to pub");
        }
        else {
            console.error("handleAnswer: subscriber has no publisher");
        }
    }
}
function handleJoin(msg, conn) {
    var publisherConn = wsConnections[msg.sess_id];
    if (typeof publisherConn === "undefined") {
        wsSendJson({ type: "join_resp", status: "error", error: "ENOTFOUND" }, conn);
        return;
    }
    var offer = publisherConn.__offer;
    if (!offer) {
        offer = getOfferFromBuffer(publisherConn.__sessId);
    }
    if (!offer) {
        wsSendJson({ type: "join_resp", status: "error", error: "ENOOFF" }, conn);
        return;
    }
    var candidates;
    if (!publisherConn.__candidates || !publisherConn.__candidates.length) {
        var bufCands = getCandidatesFromBuffer(publisherConn.__sessId);
        if (bufCands.length > 0) {
            candidates = bufCands;
        }
        else {
            console.log("---test cand---");
            console.log(JSON.stringify(bufCands, null, " "));
            console.log(JSON.stringify(bufCands.length));
            console.log(JSON.stringify(publisherConn.__candidates));
            wsSendJson({ type: "join_resp", status: "error", error: "ENOCAND" }, conn);
            return;
        }
    }
    else {
        candidates = publisherConn.__candidates;
    }
    var nick = msg.nickname || "anonymous";
    if (!publisherConn.__subscribers) {
        publisherConn.__subscribers = [];
    }
    for (var _i = 0, _a = publisherConn.__subscribers; _i < _a.length; _i++) {
        var sub = _a[_i];
        if (sub.__nick === nick) {
            wsSendJson({ type: "join_resp", status: "error", error: "ENICK" }, conn);
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
        type: "join_resp"
    }, conn);
    wsSendJson({ type: "offer", offer: offer }, conn);
    candidates.forEach(function (cand) {
        wsSendJson({ type: "candidate", candidate: cand }, conn);
    });
}
function handleDisconnect(conn) {
    if (conn.__type === "publisher") {
        console.log("publisher disconnected");
        if (conn.__subscribers) {
            conn.__subscribers.forEach(function (subs) {
                try {
                    subs.close();
                }
                catch (e) {
                    console.error(e);
                }
            });
        }
        delete wsConnections[conn.__sessId];
    }
    else if (conn.__type === "subscriber") {
        console.log("subscriber disconnected");
        if (conn.__publisher) {
            if (conn.__publisher.__subscribers) {
                conn.__publisher.__subscribers = conn.__publisher.__subscribers.filter(function (sub) {
                    return sub.__nick !== conn.__nick;
                });
            }
        }
    }
    else {
        console.log("connection without type closed");
    }
}
wsServer.on("connection", function connection(ws) {
    console.log("conn opened");
    ws.on("message", function incoming(message) {
        message = message + "";
        var logMessage = message.length > 80 ? message.slice(0, 80) : message;
        console.log("> " + logMessage);
        var json = {};
        try {
            json = JSON.parse(message);
        }
        catch (e) {
            console.error(e.message);
            return;
        }
        switch (json.type) {
            case "login":
                handleLogin(json, ws);
                break;
            case "offer":
                handleOffer(json, ws);
                break;
            case "candidate":
                handleCandidate(json, ws);
                break;
            case "join":
                handleJoin(json, ws);
                break;
            case "answer":
                handleAnswer(json, ws);
                break;
            default:
                console.log("unknown msg");
        }
    });
    ws.on("close", function () {
        console.log("conn closed");
        handleDisconnect(ws);
    });
});
httpServer.listen(port, function () { return console.log("server listening on port " + port); });
