import { IObj } from "./interfaces";

type getUserMedia_t = Navigator["getUserMedia"];

export class UserMedia {

    public getDisplayMedia(): Promise<MediaStream> {
        if (!this.canGetDisplayMedia()) {
            throw new Error("old browser");
        }
        const options: IObj = {
            audio: false,
            video: {
                cursor: "never",
            },
        };
        return (navigator.mediaDevices as any).getDisplayMedia(options);
    }

    public getAudioStream(): Promise<MediaStream> {
        return new Promise<MediaStream>((resolve, reject) => {
            const getUserMedia = this.getUserMedia();
            if (!getUserMedia) {
                return reject("old browser");
            } else {
                getUserMedia.call(navigator, {audio: true, video: false}, resolve, reject);
            }
        });
    }

    public isBrowserOld(): boolean {
        return !(this.canGetDisplayMedia() && this.getUserMedia());
    }

    private canGetDisplayMedia(): boolean {
        return navigator.mediaDevices && !!(navigator.mediaDevices as any).getDisplayMedia;
    }

    private getUserMedia(): getUserMedia_t | undefined {
        const nav = navigator as any;
        return (nav.getUserMedia || nav.webkitGetUserMedia ||
            nav.mozGetUserMedia || nav.msGetUserMedia);
    }
}
