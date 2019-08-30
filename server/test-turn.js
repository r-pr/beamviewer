const request = require('request');

console.log('foo');

request({
    method: 'POST',
    uri: 'https://networktraversal.googleapis.com/v1alpha/iceconfig?key=AIzaSyDX4ctY_VWUm7lDdO6i_-bx7J-CDkxS16I',
    headers: {
        'Origin': 'https://test.webrtc.org',
        'Referer': 'https://test.webrtc.org/',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36 OPR/60.0.3255.70'
    }
}, function (error, response, body) {
    if (error) {
        return console.error(error);
    }
    console.log('ok:', body);
});
