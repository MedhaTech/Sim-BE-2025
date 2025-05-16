import { unauthorized } from "boom";
import { NextFunction, Request, Response } from "express";
import dispatcher from "../utils/dispatch.util";
import BaseController from "./base.controller";
import { course_module } from "../models/course_module.model";
import { course_topic } from "../models/course_topic.model";
import db from "../utils/dbconnection.util"
import { constents } from "../configs/constents.config";
import { speeches } from "../configs/speeches.config";
import { Op } from "sequelize";
export default class CourseController extends BaseController {
    model = "course";

    protected initializePath(): void {
        this.path = '/courses';
    }

    protected initializeRoutes(): void {
        super.initializeRoutes();

    }
    //fetching all the course information 
    protected async getData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let data: any;
            const { model, id } = req.params;
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const paramStatus: any = newREQQuery.status
            if (model) {
                this.model = model;
            };

            // pagination
            const { page, size, title } = newREQQuery;
            let condition = title ? { title: { [Op.like]: `%${title}%` } } : null;
            const { limit, offset } = this.getPagination(page, size);
            const modelClass = await this.loadModel(model)


            const where: any = {};

            let whereClauseStatusPart: any = {};
            let whereClauseStatusPartLiteral = "1=1";
            let addWhereClauseStatusPart = false
            if (paramStatus && (paramStatus in constents.common_status_flags.list)) {
                whereClauseStatusPart = { "status": paramStatus }
                whereClauseStatusPartLiteral = `status = "${paramStatus}"`
                addWhereClauseStatusPart = true;
            }


            if (id) {
                data = await this.getDetailsData(req, res, modelClass)
            } else {
                data = await modelClass.findAll({
                    attributes: {
                        include: [
                            [// Note the wrapping parentheses in the call below!
                                db.literal(`(
                                    SELECT COUNT(*)
                                    FROM course_modules AS cm
                                    WHERE
                                        ${addWhereClauseStatusPart ? "cm." + whereClauseStatusPartLiteral : whereClauseStatusPartLiteral}
                                    AND
                                        cm.course_id = \`course\`.\`course_id\`
                                )`),
                                'course_modules_count'
                            ],
                            [// Note the wrapping parentheses in the call below!
                                db.literal(`(
                                SELECT COUNT(*)
                                FROM course_topics AS ct
                                JOIN course_modules as cm on cm.course_module_id = ct.course_module_id
                                WHERE
                                    ${addWhereClauseStatusPart ? "ct." + whereClauseStatusPartLiteral : whereClauseStatusPartLiteral}
                                AND
                                    cm.course_id = \`course\`.\`course_id\`
                                AND
                                    ct.topic_type = \"VIDEO\"
                            )`),
                                'course_videos_count'
                            ]
                        ]
                    },
                    where: {
                        [Op.and]: [
                            whereClauseStatusPart,
                            condition,
                        ]
                    }
                });
                data.filter(function (rec: any) {
                    delete rec.dataValues.password;
                    return rec;
                });
            }

            if (!data) {
                return res.status(404).send(dispatcher(res, data, 'error'));
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    }
    //sub function to fetch all module wise course data
    async getDetailsData(req: Request, res: Response, modelClass: any) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        let whereClause: any = {};
        const newParamId: any = await this.authService.decryptGlobal(req.params.id);
        whereClause[`${this.model}_id`] = JSON.parse(newParamId);
        let newREQQuery: any = {}
        if (req.query.Data) {
            let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
            newREQQuery = JSON.parse(newQuery);
        } else if (Object.keys(req.query).length !== 0) {
            return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
        }
        const paramStatus: any = newREQQuery.status;
        let whereClauseStatusPart: any = {};
        let whereClauseStatusPartLiteral = "1=1";
        let addWhereClauseStatusPart = false
        if (paramStatus && (paramStatus in constents.common_status_flags.list)) {
            whereClauseStatusPart = { "status": paramStatus }
            whereClauseStatusPartLiteral = `status = "${paramStatus}"`
            addWhereClauseStatusPart = true;
        }

        let user_id = newREQQuery.user_id;
        if (!user_id) {
            throw unauthorized(speeches.UNAUTHORIZED_ACCESS)
        }
        let data = await this.crudService.findOne(modelClass, {
            where: whereClause,

            attributes: {
                include: [
                    [// Note the wrapping parentheses in the call below!
                        db.literal(`(
                            SELECT COUNT(*)
                            FROM course_modules AS cm
                            WHERE
                                ${addWhereClauseStatusPart ? "cm." + whereClauseStatusPartLiteral : whereClauseStatusPartLiteral}
                            AND
                                cm.course_id = \`course\`.\`course_id\`
                        )`),
                        'course_modules_count'
                    ],
                    [// Note the wrapping parentheses in the call below!
                        db.literal(`(
                        SELECT COUNT(*)
                        FROM course_topics AS ct
                        JOIN course_modules as cm on cm.course_module_id = ct.course_module_id
                        WHERE
                            ${addWhereClauseStatusPart ? "ct." + whereClauseStatusPartLiteral : whereClauseStatusPartLiteral}
                        AND
                            cm.course_id = \`course\`.\`course_id\`
                        AND
                            ct.topic_type = \"VIDEO\"
                    )`),
                        'course_videos_count'
                    ]
                ]
            },
            include: [{
                model: course_module,
                as: 'course_modules',
                required: false,
                attributes: [
                    "title",
                    "description",
                    "course_module_id",
                    "course_id",
                    [
                        db.literal(`(
                            SELECT COUNT(*)
                            FROM course_topics AS ct
                            WHERE
                                ${addWhereClauseStatusPart ? "ct." + whereClauseStatusPartLiteral : whereClauseStatusPartLiteral}
                            AND
                                ct.course_module_id = \`course_modules\`.\`course_module_id\`
                            AND
                                ct.topic_type = "VIDEO"
                        )`),
                        'videos_count'
                    ]
                ],
                where: {
                    [Op.and]: [
                        whereClauseStatusPart
                    ]
                },
                include: [{
                    model: course_topic,
                    as: "course_topics",
                    required: false,
                    attributes: [
                        "title",
                        "course_module_id",
                        "course_topic_id",
                        "topic_type_id",
                        "topic_type",
                        [
                            // Note the wrapping parentheses in the call below!
                            db.literal(`(
                                SELECT CASE WHEN EXISTS 
                                    (SELECT status 
                                    FROM user_topic_progress as p 
                                    WHERE p.user_id = ${user_id} 
                                    AND p.course_topic_id = \`course_modules->course_topics\`.\`course_topic_id\`) 
                                THEN  
                                    (SELECT case p.status when NULL then "INCOMPLETE" ELSE p.status END AS progress 
                                    FROM user_topic_progress AS p
                                    WHERE p.course_topic_id = \`course_modules->course_topics\`.\`course_topic_id\`
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
                                ct.video_id = \`course_modules->course_topics\`.\`topic_type_id\`
                                AND
                                \`course_modules->course_topics\`.\`topic_type\` = "VIDEO"
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
                                END AS topic_type_order
                                FROM course_topics as ct
                                WHERE ct.course_topic_id = \`course_modules->course_topics\`.\`course_topic_id\`
                            )`),
                            'topic_type_order'
                        ]
                    ],
                    where: {
                        [Op.and]: [
                            whereClauseStatusPart
                        ]
                    },
                }]
            }
            ],
            order: [
                db.literal(`\`course_modules.course_topics.topic_type_order\` ASC`),
                [course_module, course_topic, 'course_topic_id', 'ASC'],
            ],
        });
        return data;
    }

}