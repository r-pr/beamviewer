import React from "react";
import "./Footer.css";

export default class Footer extends React.Component<{}, {}> {
    public render() {
        return (
            <div className="Footer">
                <p><a
                    href="https://github.com/r-pr/beamviewer"
                    target="_blank"
                    rel="noopener noreferrer"
                >View on GitHub</a></p>
            </div>
        );
    }
}
