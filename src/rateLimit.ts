import {BotContext} from "./types";


export default class RateLimit {
    constructor(private timeoutSecs: number) {
    }

     async isRateLimited(ctx: BotContext): Promise<boolean> {
        // If from the past generation to now less than timeoutSecs, then rate limited
        const lastGenerationDT = ctx.User.lastGenerationDT;
        if (lastGenerationDT === null) {
            return false;
        }

        if (ctx.User.leftGenerations <= 0) {
            return true;
        }

        const diff = (new Date()).getTime() - lastGenerationDT.getTime();
        const diffSecs = diff / 1000;
        return diffSecs < this.timeoutSecs;
     }
}
