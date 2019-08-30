export function translateErrCode(errCode: string): string {
    switch (errCode) {
    case "ENOTFOUND":
        return "Session with given ID not found";
    default:
        return errCode;
    }
}
