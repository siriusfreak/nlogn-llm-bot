
const now = new Date();
const utcTimestamp = now.getTime();

export function getStartTimestamp() {
    return utcTimestamp / 1000;
}


