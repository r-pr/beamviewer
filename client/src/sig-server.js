function SignalingServer(url) {

    let ws = null;

    let pendingPromise = {};

    let sessId = null;

    function onMessage(msg){
        let json = {}
        try {
            json = JSON.parse(msg.data);
        } catch (e) {
            console.warn('ws: ' + e.message + '. msg.data=' + msg.data);
            return;
        }
        console.log('ws: ', json);
        switch (json.type) {
        case 'login_resp':
            handleLoginResp(json);
            break;
        case 'candidate':
            handleCandidate(json);
            break;
        case 'offer':
            handleOffer(json);
            break;
        case 'answer':
            handleAnswer(json);
            break;
        default:
            console.trace("unknown: ", json);
        }
    }

    function handleLoginResp(resp) {
        if (resp.status === 'ok') {
            pendingPromise.resolve(sessId);
        } else {
            console.warn('ws: ' + JSON.stringify(resp));
            pendingPromise.resolve(null)
        }
        pendingPromise = {};
    }

    const handleCandidate = (msg) => {
        console.log(Date.now() + ' ws: got candidate')
        if (this.onCandidate && typeof this.onCandidate === 'function') {
            this.onCandidate(msg.candidate);
        }
    }

    const handleOffer = (msg) => {
        console.log(Date.now() + ' ws: got offer')
        if (this.onOffer && typeof this.onOffer === 'function') {
            this.onOffer(msg.offer);
        }
    }

    const handleAnswer = (msg) => {
        console.log(Date.now() + ' ws: got answer')
        if (this.onAnswer && typeof this.onAnswer === 'function') {
            this.onAnswer(msg.answer);
        }
    }

    this.getSessId = () => sessId;

    this.connect = () => {
        return new Promise((resolve, reject) => {
            ws = new WebSocket(url);
            ws.onopen = resolve;
            ws.onerror = reject;
            ws.onmessage = onMessage;
        });
    }

    this.logIn = () => {
        return new Promise((resolve, reject) => {
            pendingPromise = { resolve, reject };
            sessId = generateRandomString();
            this.send({
                type: 'login',
                sess_id: sessId
            });
        });
    }

    this.send = (obj) => {
        ws.send(JSON.stringify(obj));
    }
}


function generateRandomString() {
    const len = 16;
    const numbers = new Uint8Array(len);
    const letters = [];
    window.crypto.getRandomValues(numbers);
    numbers.forEach( n => letters.push(n.toString(16)) );
    return letters.join('')
}

module.exports = SignalingServer;
