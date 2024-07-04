import DashboardService from "../services/dashboard.service";
import BaseJobs from "./base.job";

export default class DashboardMapStatsJob extends BaseJobs {

    service: DashboardService = new DashboardService;
    protected init() {
        this.name = 'dashboard_map_stats';
        // this.period = "* * * * *"// every night 12 am 
        // this.period = "0 0 * * *" every night 12 am 
        this.period = "0 */6 * * *" // every 6 hours 
        // this.period = "0 * * * *" // every hour 
    };

    public async executeJob() {
        super.executeJob();
        //TODO: write the logic to execute to badges Job...!!
        return await this.service.resetMapStats()
    }
}