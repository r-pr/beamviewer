import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./index.css";
import * as serviceWorker from "./serviceWorker";

if (process.env.NODE_ENV === "production" &&
    window.location.protocol === "http:" &&
    window.location.hostname !== "localhost") {
    console.log("redirect to https");
    // screen capture api only works via https
    window.location.replace(window.location.href.replace("http:", "https:"));
}

ReactDOM.render(<App />, document.getElementById("root"));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
serviceWorker.unregister();
