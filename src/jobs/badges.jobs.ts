import BadgesService from "../services/badges.service";
import BaseJobs from "./base.job";

export default class BadgesJob extends BaseJobs {

    service: BadgesService = new BadgesService;
    protected init() {
        this.name = 'badges';
        this.period = "0 0 * * *" //every night 12 am 
    };

    public async executeJob() {
        super.executeJob();
        //TODO: write the logic to execute to badges Job...!!
        const result: any = {}
        result['CreativeGuideBadge'] = await this.service.CreativeGuideBadge()
        result['InnovativeLeaderBadge'] = await this.service.InnovativeLeaderBadge()
        return result
    }
}