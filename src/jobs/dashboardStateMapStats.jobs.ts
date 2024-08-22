

import DashboardStateService from "../services/dashboardstatewise.service";
import BaseJobs from "./base.job";

export default class DashboardStateMapStatsJob extends BaseJobs {

    service: DashboardStateService = new DashboardStateService;
    protected init() {
        this.name = 'dashboard_state_map_stats';

        this.period = "0 */6 * * *" // every 6 hours 

    };

    public async executeJob() {
        super.executeJob();
        //TODO: write the logic to execute to badges Job...!!
        return await this.service.resetStateMapStats();
    }
}