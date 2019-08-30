Дипломный проект.

https://beamviewer22.herokuapp.com/

# TODO

* возможность поставить на паузу
* задавать ширину - высоту видео, чтоб всегда вмещалось на экран
* убрать никнеймы
* вместо addStream/removeStream - addTrack, removeTrack

# Баги

* паблишер на рабочем (хром), субскрайбер на домашнем (мозила) - работает
* паблишер на домашнем, субс на рабочем - либо просто не работает, либо не работает с ошибкой
`Uncaught (in promise) DOMException: Failed to execute 'addIceCandidate' on 'RTCPeerConnection': Error processing ICE candidate`
* паблишер на домашнем (опера), субс на рабочем - ок (но иногда не срабатывает)
* погуглить: ICE кандидаты между разными браузерами

* потестить в опере: ошибка у субскрайбера

```
Uncaught DOMException: Failed to construct 'RTCIceCandidate': The 'candidate' property is not a string, or is empty.
    at SigServerClient.sigServer.onCandidate (http://localhost:3000/static/js/main.chunk.js:913:39)
    at SigServerClient.handleCandidate (http://localhost:3000/static/js/main.chunk.js:1410:12)
    at SigServerClient.onMessage
```

# Заметки

клиент запрашивает у сервера список стун и турн серверов, если ок - использует
его, если нет - использует дефолтный. см server/test-turn.js (кеширует ответ, не запрашивает
если последний запрос был меньше 10 минут назад чтоб не задалбывать гугл)
