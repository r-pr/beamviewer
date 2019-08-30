Записка к дипломному проекту
============================

ПО состоит из клиентской и серверной частей. Серверная часть работает на Node.js. Обе части написаны на TypeScript, а перед развертыванием компилируются в JavaScript. Интерфейс клиента использует React и Bootstrap. Базы данных ПО не использует.

Основная часть функционала приложения реализована с помощью API, предоставляемых современными браузерами. Среди них:

* [получение видео с экрана](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API)
* [получение аудио с микрофона](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getUserMedia)
* передача аудио/видео данных между браузерами ([WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API))

Сервер используется для:

* обмена контактными данными между браузерами, необходимым для создания WebRTC-соединения (WebSocket)
* получения списка серверов, необходимых для создания WebRTC-соединения (HTTP)
* выдачи статического контента (т.е. клиентской части) (HTTP)

Технология WebRTC позволяет передавать данные непосредственно между компьютерами пользователей, минуя сервер. Обмен данными через сервер идет только в том случае, если настройки сети не позволяют установить прямое соединение. При этом вся работа по выбору оптимального соединения и его установке выполняется самим браузером и скрыта от разработчика за относительно простым API.

На стороне сервера для обработки HTTP-запросов используется фреймворк Express:

```
// server/src/server.ts

app.use(express.static(path.join(__dirname, "..", "..", "client", "build") ));
```

# Алгоритм установки подключения между двумя клиентами

* Пользователь №1 (П1) вводит адрес в браузер, сервер обрабатывает GET-запросы на статические файлы и отдает их браузеру, страница отображается.

* П1 нажимает кнопку "Создать сессию".

* Фронтенд П1 генерирует случайную строку с ID сессии и отправляет по WebSocket сообщение `login`.'

* Сервер проверяет список подключений, если уже есть подключение с таким же ID - отвечает ошибкой, иначе - добавляет сохраняет в "словарь" это подключение (ключом выступает ID сессии) и отвечает `login_resp::ok`. Таким образом, после успешного "логина" имеется WebSocket-соединение, связанное с определенным ID cессии.

* Далее фронтенд П1 запрашивает список ICE-серверов (STUN и/или TURN). STUN-сервера используются для того, чтобы клиент мог определить свой публичный адрес и возможность установки прямого подключения к другому браузеру. TURN-сервера используются в качестве промежуточного звена, если прямое соединение невозможно.

* Фронтенд П1 получает видео-поток с экрана компьютера:

```
// client/src/user-media.ts

(navigator.mediaDevices as any).getDisplayMedia(options);
```

* Фронтенд П1 создает WebRTC-подключение:

```
// client/src/rtc-connection.ts

this.rtcConnection = new RTCPeerConnection({iceServers});
```

* WebRTC-подключению добавляется полученный поток видео:

```
// client/src/rtc-connection.ts

(this.rtcConnection as any).addStream(stream);
```
* WebRTC-подключение создает SDP-предложение, которое затем устанавливается в качестве описания локального узла и отправляется на сервер, который связывает его c тем WebSocket-подключением, по которому оно пришло.

```
// client/src/components/PubScreen.tsx

const offer = await tmpConn.createOffer();
tmpConn.setLocalDescription(offer);
sendOffer(offer);
```

* После вызова `setLocalDescription()` `RTCPeerConnection` начинает вызывать коллбэк `onicecandidate`, которому передаются возможные кандидаты с которыми удаленный узел может попытаться установить соединение. Они отправляются на сервер, который их сохраняет и связывает их с WebSocket-подключением, по которому они приходят.

```
// client/src/rtc-connection.ts

this.rtcConnection.onicecandidate = (event: any) => {
    if (event.candidate) {
        this.emit("candidate", event.candidate);
    }
};

// client/src/components/PubScreen.tsx

pubConn.on("candidate", (candidate) => {
    // ...
    sigServer.send({
        type: "candidate",
        candidate
    });
});

// server/src/server.ts

function handleCandidate(msg: IObj, conn: IConn) {
    if (conn.__type === "publisher") {
        conn.__candidates.push(msg.candidate);
        // ...
    }
    // ...
}
```

* На этом этапе имеется частично инициализированное WebRTC-подключение и рабочее WebSocket-подключение, c которым связаны ID сессии, SDP-предложение и кандидаты.

* Пользователь №2 (П2) заходит на сайт, вводит ID сессии, полученный от П1 и нажимает "Присоединиться".

* Фронтенд П2 открывает WebSocket-подключение и отправляет `join` с указанием ID сессии, а также создает экземляр `RTCPeerConnection`.

* Сервер находит список подключений с заданным айди, если все в порядке - отправляет `join_resp::ok`, находит SDP-предложение и кандидатов, связанных с данным ID и отправляет их П2.

```
server/src/server.ts

function handleJoin(msg: IObj, conn: IConn) {
    // ...
    let offer: IObj | undefined = publisherConn.__offer;
    // ...
    candidates = publisherConn.__candidates;
    // ...
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
```
* Фронтенд П2 при получении от сервера кандидатов от П1 передает их WebRTC-подключению: `rtcConnection.addIceCandidate(new RTCIceCandidate(cand))`

* Фронтенд П2 при получении SDP-оффера:
  * устанавливает его в качестве описания удаленного узла
  * создает SDP-ответ
  * устанавливает SDP-ответ в качестве описания локального узла
  * отправляет ответ на сервер

```
// client/src/components/SubScreen.tsx

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
```

* Сервер при получения SDP-ответа передает его П1:

```
// server/src/server.ts

function handleAnswer(msg: IObj, conn: IConn) {
    // ...
    if (conn.__publisher) {
        wsSendJson(msg, conn.__publisher);
    }
    // ...
}
```

* Фронтенд П1 при получении SDP-ответа устанавливает его в качестве описания удаленного узла:

```
// client/src/components/PubScreen.tsx

sigServer.onAnswer = (answer: any) => {
    tmpConn.setRemoteDescription(new RTCSessionDescription(answer));
    // ...
};
```

* После этого состояние RTC-подключения меняется на "connected", счетчик подлкюченных клиентов увеличивается на 1:

```
// client/src/rtc-connection.ts

this.rtcConnection.oniceconnectionstatechange  = () => {
    if (this.rtcConnection.iceConnectionState === "connected") {
        this.emit("connected");
    }
    // ...
};

// client/src/components/PubScreen.tsx

pubConn.once("connected", () => this.incrementPeersCount());
```

* Если П2 отключается, состояние RTC-подключения меняется на "disconnected", счетчик подлкюченных клиентов уменьшается на 1:

```
// client/src/rtc-connection.ts

this.rtcConnection.oniceconnectionstatechange  = () => {
    // ...
    if (this.rtcConnection.iceConnectionState === "disconnected") {
        this.rtcConnection.close();
        this.emit("disconnected");
    }
};

// client/src/components/PubScreen.tsx

pubConn.once("disconnected", () => this.decrementPeersCount() );
```
