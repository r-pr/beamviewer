import React from "react";
import { StreamState_t } from "../interfaces";

type void_fn_t = () => void;

interface IProps {
    onPause: void_fn_t;
    onResume: void_fn_t;
    onStop: void_fn_t;
    streamState: StreamState_t;
}

export const PubScreenControls: React.FC<IProps> = (props) => {
    const pauseDisabled = props.streamState !== "active";
    const resumeDisabled = props.streamState !== "paused";
    return (
        <div className="row" style={{marginTop: "2em"}}>
            <div className="col-sm-4">
                <button
                    className="btn btn-block btn-warning"
                    disabled={pauseDisabled}
                    onClick={props.onPause}
                >
                    Pause
                </button>
            </div>
            <div className="col-sm-4">
                <button
                    className="btn btn-block btn-success"
                    disabled={resumeDisabled}
                    onClick={props.onResume}
                >
                    Resume
                </button>
            </div>
            <div className="col-sm-4">
                <button className="btn btn-block btn-danger" onClick={props.onStop}>
                    Stop
                </button>
            </div>
        </div>
    );
};
