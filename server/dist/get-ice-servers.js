"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var request_1 = __importDefault(require("request"));
var CACHING_TIME_MSEC = 1000 * 60 * 10;
var cachedIceServers = [];
var iceServersRetrievedTime = 0;
function getIceServers(cb) {
    var now = Date.now();
    if (now - iceServersRetrievedTime < CACHING_TIME_MSEC) {
        console.log("returned servers from cache");
        cb(null, cachedIceServers);
        return;
    }
    request_1["default"]({
        headers: {
            "Origin": "https://test.webrtc.org",
            "Referer": "https://test.webrtc.org/",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
                " (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36 OPR/60.0.3255.70"
        },
        method: "POST",
        uri: "https://networktraversal.googleapis.com/v1alpha/iceconfig?key=AIzaSyDX4ctY_VWUm7lDdO6i_-bx7J-CDkxS16I"
    }, function (error, response, body) {
        if (error) {
            return cb(error, []);
        }
        try {
            body = JSON.parse(body);
        }
        catch (e) {
            return cb(e, []);
        }
        if (!body.iceServers || !body.iceServers.length) {
            return cb(new Error("no iceServers in response"), []);
        }
        cachedIceServers = body.iceServers;
        iceServersRetrievedTime = Date.now();
        console.log("fetched new servers");
        cb(null, body.iceServers);
    });
}
exports["default"] = getIceServers;
