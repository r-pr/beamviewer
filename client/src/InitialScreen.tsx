import React from "react";
import { IUserAppMode } from "./interfaces";
import { Settings} from "./settings";

const { MAIN_DIV_CLASS } = Settings;

const CHAR_CODE_ENTER = 13;

interface IProps {
    onDecision: (d: IUserAppMode) => void;
    error: string;
}

interface IState {
    sessId: string;
    nickName: string;
    audioChecked: boolean;
}

export default class InitialScreen extends React.Component<IProps, IState> {

    constructor(p: IProps, c: any) {
        super(p, c);
        this.onClickPub = this.onClickPub.bind(this);
        this.onClickSub = this.onClickSub.bind(this);
        this.onKeyPress = this.onKeyPress.bind(this);
        this.handleSessIdChange = this.handleSessIdChange.bind(this);
        this.handleNickNameChnage = this.handleNickNameChnage.bind(this);
        this.handleAudioCheckboxChange = this.handleAudioCheckboxChange.bind(this);
        this.state = {
            sessId: "",
            nickName: "",
            audioChecked: false
        };
    }

    public render() {
        return (
            <React.Fragment>
                <div className="row">
                    <div className={MAIN_DIV_CLASS}>
                        <div className="input-group mb-3">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Session ID"
                                value={this.state.sessId}
                                onChange={this.handleSessIdChange}
                                onKeyPress={this.onKeyPress}
                                style={{textAlign: "center"}}
                            />
                        </div>
                        <button
                            className="btn btn-primary btn-block"
                            onClick={this.onClickSub}
                        >
                            Join session
                        </button>
                    </div>
                </div>
                <div className="row">
                    <div className={MAIN_DIV_CLASS}>
                        <hr style={{margin: "2em 0em"}}/>
                        <div className="form-group">
                            <button
                                style={{marginBottom: "0.8em"}}
                                className="btn btn-success btn-block"
                                onClick={this.onClickPub}
                            >
                                Create session
                            </button>
                            <div className="form-group form-check">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="checkAudio"
                                    onChange={this.handleAudioCheckboxChange}
                                    checked={this.state.audioChecked}
                                />
                                <label className="form-check-label" htmlFor="checkAudio">
                                    With audio
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    className="row"
                    style={{ display: this.props.error ? "block" : "none" }}
                >
                    <div className={MAIN_DIV_CLASS}>
                        <div
                            className="alert alert-danger"
                            role="alert"
                            style={{marginTop: "1em"}}
                        >
                            {this.props.error}
                        </div>
                    </div>
                </div>
            </React.Fragment>
        );
    }

    private handleSessIdChange(e: any) {
        this.setState({sessId: e.target.value.trim()});
    }

    private handleNickNameChnage(e: any) {
        this.setState({nickName: e.target.value.trim()});
    }

    private handleAudioCheckboxChange(e: any) {
       this.setState({audioChecked: e.target.checked});
    }

    private onKeyPress(evt: any) {
        evt = evt || window.event;
        const charCode = evt.keyCode || evt.which;
        if (charCode === CHAR_CODE_ENTER) {
            this.onClickSub(null);
        }
    }

    private onClickPub(e: any) {
        this.props.onDecision({
            mode: "pub",
            withAudio: this.state.audioChecked
        });
    }

    private onClickSub(e: any) {
        this.props.onDecision({
            mode: "sub",
            // nickName:  this.state.nickName,
            nickName: Date.now().toString(),
            sessionId: this.state.sessId,
        });
    }
}
