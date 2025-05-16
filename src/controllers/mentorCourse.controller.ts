import { unauthorized } from "boom";
import { NextFunction, Request, Response } from "express";
import dispatcher from "../utils/dispatch.util";
import BaseController from "./base.controller";
import db from "../utils/dbconnection.util"
import { constents } from "../configs/constents.config";
import { speeches } from "../configs/speeches.config";
import { Op } from "sequelize";
import { mentor_course_topic } from "../models/mentor_course_topic.model";

export default class MentorCourseController extends BaseController {
    model = "mentor_course";

    protected initializePath(): void {
        this.path = '/mentorCourses';
    }
    protected initializeRoutes(): void {
        super.initializeRoutes();

    }
    //fetching mentor course details
    protected async getData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        let user_id = res.locals.user_id;
        if (!user_id) {
            throw unauthorized(speeches.UNAUTHORIZED_ACCESS)
        }
        const newParams: any = await this.authService.decryptGlobal(req.params.id);
        const id = JSON.parse(newParams);
        const objWhereClauseStatusPart = this.getWhereClauseStatsPart(req);
        let includePart = null
        let orderBypart: any = []
        if (id) {
            orderBypart = [
                [mentor_course_topic, 'mentor_course_topic_id', 'ASC'],
            ]
            includePart = [{
                model: mentor_course_topic,
                required: false,
                attributes: [
                    "title",
                    "mentor_course_id",
                    "mentor_course_topic_id",
                    "topic_type_id",
                    "topic_type",
                    [
                       
                        db.literal(`(
                            SELECT CASE WHEN EXISTS 
                                (SELECT status 
                                FROM mentor_topic_progress as p 
                                WHERE p.user_id = ${user_id} 
                                AND p.mentor_course_topic_id = \`mentor_course_topics\`.\`mentor_course_topic_id\`) 
                            THEN  
                                (SELECT case p.status when NULL then "INCOMPLETE" ELSE p.status END AS progress 
                                FROM mentor_topic_progress AS p
                                WHERE p.mentor_course_topic_id = \`mentor_course_topics\`.\`mentor_course_topic_id\`
                                AND p.user_id = ${user_id}
                                ORDER BY p.updated_at DESC
                                LIMIT 1)
                            ELSE 
                                '${constents.task_status_flags.default}'
                            END as progress
                        )`),
                        'progress'
                    ],
                    [
                        db.literal(`(
                            SELECT video_duration
                            FROM videos AS ct
                            WHERE
                            ct.video_id = \`mentor_course_topics\`.\`topic_type_id\`
                            AND
                            \`mentor_course_topics\`.\`topic_type\` = "VIDEO"
                        )`),
                        'video_duration'
                    ],
                    [
                        db.literal(`(
                            SELECT 
                            CASE
                                WHEN ct.topic_type = "VIDEO" THEN 1
                                WHEN ct.topic_type = "QUIZ" THEN 2
                                WHEN ct.topic_type = "WORKSHEET" THEN 3
                                WHEN ct.topic_type = "ATTACHMENT" THEN 4
                            END AS topic_type_order
                            FROM mentor_course_topics as ct
                            WHERE ct.mentor_course_topic_id = \`mentor_course_topics\`.\`mentor_course_topic_id\`
                        )`),
                        'topic_type_order'
                    ]
                ],
                where: {
                    [Op.and]: [
                        objWhereClauseStatusPart.whereClauseStatusPart
                    ]
                },
            }]
        }
        return super.getData(req, res, next, [],
            {
                include: [

                    [
                        db.literal(`(
                        SELECT COUNT(*)
                        FROM mentor_course_topics AS ct
                        WHERE
                            ${objWhereClauseStatusPart.addWhereClauseStatusPart ? "ct." + objWhereClauseStatusPart.whereClauseStatusPartLiteral : objWhereClauseStatusPart.whereClauseStatusPartLiteral}
                        AND
                            ct.mentor_course_id = \`mentor_course\`.\`mentor_course_id\`
                        AND
                            ct.topic_type = \"VIDEO\"
                    )`),
                        'course_videos_count'
                    ]
                ]
            },
            includePart,
            orderBypart
        )

    }

}