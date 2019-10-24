import { Db, MongoClient } from "mongodb";

const COLL_ICE_SERVERS_REQUESTS = "iceServersRequests";

export class DbLayer {
    private db: Db | null = null;

    constructor() {
        this.connect();
    }

    public saveIceServersRequest(): void {
        if (!this.db) {
            return;
        }
        this.db.collection(COLL_ICE_SERVERS_REQUESTS).insertOne({time: Date.now()});
    }

    private connect() {
        this.db = null;
        console.log("DbLayer: connecting...");
        MongoClient.connect(this.getMongoUrl(), { useUnifiedTopology: true }, (err, client) => {
            if (err) {
                console.error(err);
                setTimeout(() => {
                    this.connect();
                }, 10000);
                return;
            }
            console.log("DbLayer: connected");
            this.db = client.db(this.getMongoDbName());
            this.db.once("close", () => {
                console.log("DbLayer: conn closed");
                this.connect();
            });
            this.db.once("error", (error) => {
                console.error(error);
                this.connect();
            });
        });
    }

    private getMongoUrl(): string {
        return this.getEnvVariable("MONGO_URL");
    }

    private getMongoDbName(): string {
        return this.getEnvVariable("MONGO_DB_NAME");
    }

    private getEnvVariable(varName: string): string {
        if (!process.env[varName]) {
            throw new Error(`${varName} env variable not set`);
        } else {
            return process.env[varName] as string;
        }
    }
}
