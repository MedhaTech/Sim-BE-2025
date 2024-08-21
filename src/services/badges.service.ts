import { QueryTypes } from "sequelize";
import BaseService from "./base.service";
import db from "../utils/dbconnection.util";
import authService from "./auth.service";

export default class BadgesService extends BaseService {
    authService: authService = new authService;

    async CreativeGuideBadge() {
        try {
            const userIds = await db.query(`SELECT 
    (SELECT 
            user_id
        FROM
            mentors
        WHERE
            mentors.mentor_id = t.mentor_id) AS user_id
FROM
    teams t
        LEFT JOIN
    challenge_responses cr ON t.team_id = cr.team_id
WHERE
    t.mentor_id NOT IN (SELECT 
            mentor_id
        FROM
            mentors
        WHERE
            badges LIKE '%"creative_guide":{"completed":"YES"}%')
GROUP BY t.mentor_id
HAVING COUNT(DISTINCT t.team_id) = COUNT(CASE
    WHEN cr.status = 'SUBMITTED' THEN 1
END)`, { type: QueryTypes.SELECT })
            userIds.map(async (kl: any) => {
                await this.authService.addbadgesformentor(kl.user_id, ['creative_guide'])
            })
            return "CreativeGuideBadge cron job executed"
        } catch (err) {
            return err
        }
    }
    async InnovativeLeaderBadge() {
        try {
            const userIds = await db.query(`SELECT 
    user_id
FROM
    mentors
WHERE
    badges LIKE '%"creative_guide":{"completed":"YES"}%'
        && badges LIKE '%"inspirational_mentor":{"completed":"YES"}%'`, { type: QueryTypes.SELECT })
            userIds.map(async (kl: any) => {
                await this.authService.addbadgesformentor(kl.user_id, ['innovative_leader'])
            })
            return "InnovativeLeaderBadge cron job executed"
        } catch (err) {
            return err
        }
    }

}