import React from "react";

import "./App.css";
import PubScreen from "./components/PubScreen";
import SubScreen from "./components/SubScreen";
import InitialScreen from "./InitialScreen";
import Footer from "./components/Footer";
import { IUserAppMode } from "./interfaces";

interface IState {
    appMode?: IUserAppMode;
    error: string;
}

export default class App extends React.Component<{}, IState> {

    constructor(p: {}, c: any) {
        super(p, c);
        this.state = {
            error: "",
        };
        this.onUserDecision = this.onUserDecision.bind(this);
        this.onExit = this.onExit.bind(this);
    }

    public render() {
        return (
            <div className="container-fluid">
                <div className="row">
                    <h1 className="col-sm-12 App-header2" style={{textAlign: "center"}}>
                        BeamViewer
                    </h1>
                </div>
                {this.getActiveComponent()}
            </div>
        );
    }

    private onExit(err?: Error) {
        if (err) {
            this.setState({appMode: undefined, error: err.message});
        } else {
            this.setState({appMode: undefined});
        }
    }

    private onUserDecision(decision: IUserAppMode) {
        this.setState({appMode: decision});
    }

    private getActiveComponent(): JSX.Element {
        if (this.state.appMode) {
            if (this.state.appMode.mode === "pub") {
                return (
                    <PubScreen
                        withAudio={this.state.appMode.withAudio}
                        onExit={this.onExit}
                    />
                );
            } else if (this.state.appMode.mode === "sub") {
                return (
                    <SubScreen
                        nickName={this.state.appMode.nickName}
                        sessId={this.state.appMode.sessionId}
                        onExit={this.onExit}
                    />
                );
            } else {
                throw new Error();
            }
        } else {
            return (
                <React.Fragment>
                    <InitialScreen
                        onDecision={this.onUserDecision}
                        error={this.state.error}
                    />
                    <Footer/>
                </React.Fragment>
            );
        }
    }
}
