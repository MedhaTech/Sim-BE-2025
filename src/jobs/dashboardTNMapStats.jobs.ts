

import DashboardTNService from "../services/dashboardtnwise.service";
import BaseJobs from "./base.job";

export default class DashboardTNMapStatsJob extends BaseJobs {

    service: DashboardTNService = new DashboardTNService;
    protected init() {
        this.name = 'dashboard_TN_map_stats';
        this.period = "0 3 * * *" // Every Day at 3 AM
    };

    public async executeJob() {
        super.executeJob();
        //TODO: write the logic to execute to badges Job...!!
        return await this.service.resetTNMapStats();
    }
}