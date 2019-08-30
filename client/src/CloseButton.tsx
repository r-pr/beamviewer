import React from "react";

import "./CloseButton.css";

interface IState {
    hovered: boolean;
}

interface IProps {
    onExit: () => void;
}

export default class CloseButton extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            hovered: false
        };
    }
    public render() {
        return (
            <div
                className="CloseButton"
                onClick={this.props.onExit}
            >
                <p title="Exit">×</p>
            </div>
        );
    }
}
