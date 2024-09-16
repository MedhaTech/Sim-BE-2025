import { badData, badRequest, internal, notFound, unauthorized } from "boom";
import { NextFunction, Request, Response } from "express";
import { Op, QueryTypes } from "sequelize";
import db from "../utils/dbconnection.util";
import { constents } from "../configs/constents.config";
import { speeches } from "../configs/speeches.config";
import validationMiddleware from "../middlewares/validation.middleware";
import { challenge_response } from "../models/challenge_response.model";
import dispatcher from "../utils/dispatch.util";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import { student } from "../models/student.model";
import fs from 'fs';
import { S3 } from "aws-sdk";
import { challengeResponsesSchema, challengeResponsesUpdateSchema, initiateIdeaSchema, UpdateAnyFieldSchema } from "../validations/challenge_responses.validations";
import { evaluation_process } from "../models/evaluation_process.model";
import { evaluator_rating } from "../models/evaluator_rating.model";
import { baseConfig } from "../configs/base.config";

export default class ChallengeResponsesController extends BaseController {

    model = "challenge_response";

    protected initializePath(): void {
        this.path = '/challenge_response';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(challengeResponsesSchema, challengeResponsesUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.post(this.path + "/:id/initiate/", validationMiddleware(initiateIdeaSchema), this.initiateIdea.bind(this));
        this.router.post(this.path + "/fileUpload", this.handleAttachment.bind(this));
        this.router.put(this.path + '/updateEntry/:id', validationMiddleware(UpdateAnyFieldSchema), this.updateAnyFields.bind(this));
        this.router.get(this.path + '/submittedDetails', this.getResponse.bind(this));
        this.router.get(this.path + '/fetchRandomChallenge', this.getRandomChallenge.bind(this));
        this.router.get(`${this.path}/evaluated/:evaluator_id`, this.getChallengesForEvaluator.bind(this))
        this.router.get(`${this.path}/finalEvaluation/`, this.finalEvaluation.bind(this));
        this.router.get(`${this.path}/ideastatusbyteamId`, this.getideastatusbyteamid.bind(this));
        this.router.get(`${this.path}/schoolpdfideastatus`, this.getSchoolPdfIdeaStatus.bind(this));
        this.router.get(this.path + '/submittedDetailsforideapdf', this.getResponseideapdf.bind(this));
        super.initializeRoutes();
    }

    protected async getData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EADMIN' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        let user_id = res.locals.user_id || res.locals.state_coordinators_id;
        let newREQQuery: any = {}
        if (req.query.Data) {
            let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
            newREQQuery = JSON.parse(newQuery);
        } else if (Object.keys(req.query).length !== 0) {
            return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
        }
        let { team_id } = newREQQuery;
        if (!user_id) {
            throw unauthorized(speeches.UNAUTHORIZED_ACCESS)
        }
        let data: any;
        let responseOfFindAndCountAll: any;
        const { model, id } = req.params;
        const paramStatus: any = newREQQuery.status;
        const evaluation_status: any = newREQQuery.evaluation_status;
        const district: any = newREQQuery.district;
        const state: any = newREQQuery.state;
        const focus_area: any = newREQQuery.focus_area;
        const theme: any = newREQQuery.theme;
        const rejected_reason: any = newREQQuery.rejected_reason;
        const rejected_reasonSecond: any = newREQQuery.rejected_reasonSecond;
        const evaluator_id: any = JSON.stringify(newREQQuery.evaluator_id);
        const level: any = newREQQuery.level;
        const yetToProcessList: any = newREQQuery.yetToProcessList;
        if (model) {
            this.model = model;
        };
        // pagination
        const { page, size, title } = newREQQuery;
        let condition: any = {};
        if (team_id) {
            condition = { team_id };
        }
        const { limit, offset } = this.getPagination(page, size);
        const modelClass = await this.loadModel(model).catch(error => {
            next(error)
        });
        const where: any = {};
        let whereClauseStatusPart: any = {}
        let additionalFilter: any = {};
        let boolStatusWhereClauseEvaluationStatusRequired = false;
        //status filter
        if (paramStatus && (paramStatus in constents.challenges_flags.list)) {
            whereClauseStatusPart = { "status": paramStatus };
            boolStatusWhereClauseEvaluationStatusRequired = true;
        } else if (paramStatus === 'ALL') {
            whereClauseStatusPart = {};
            boolStatusWhereClauseEvaluationStatusRequired = false;
        } else {
            whereClauseStatusPart = { "status": "SUBMITTED" };
            boolStatusWhereClauseEvaluationStatusRequired = true;
        };
        //evaluation status filter
        if (evaluation_status) {
            if (evaluation_status in constents.evaluation_status.list) {
                whereClauseStatusPart = { 'evaluation_status': evaluation_status };
            } else {
                whereClauseStatusPart['evaluation_status'] = null;
            }
        }
        if (theme) {
            additionalFilter['theme'] = theme && typeof theme == 'string' ? theme : {}
        }

        if (rejected_reason) {
            additionalFilter['rejected_reason'] = rejected_reason && typeof rejected_reason == 'string' ? rejected_reason : {}
        }
        if (rejected_reasonSecond) {
            additionalFilter['rejected_reasonSecond'] = rejected_reasonSecond && typeof rejected_reasonSecond == 'string' ? rejected_reasonSecond : {}
        }
        if (evaluator_id) {
            additionalFilter['evaluated_by'] = evaluator_id && typeof evaluator_id == 'string' ? evaluator_id : {}
        }
        if (district) {
            additionalFilter["district"] = district && typeof district == 'string' ? district : {}
        }
        if (state) {
            additionalFilter["state"] = state && typeof state == 'string' ? state : {}
        }
        if (focus_area) {
            additionalFilter["focus_area"] = focus_area && typeof focus_area == 'string' ? focus_area : {}
        }
        if (id) {
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            where[`${this.model}_id`] = newParamId;
            try {
                if (level && typeof level == 'string') {
                    switch (level) {
                        case 'L1':
                            data = await this.crudService.findOne(modelClass, {
                                attributes: [
                                    "challenge_response_id",
                                    "challenge_id",
                                    "theme",
                                    "state",
                                    "focus_area",
                                    "team_id",
                                    "title",
                                    "problem_statement",
                                    "causes",
                                    "effects",
                                    "community",
                                    "facing",
                                    "solution",
                                    "stakeholders",
                                    "problem_solving",
                                    "feedback",
                                    "prototype_image",
                                    "prototype_link",
                                    "workbook",
                                    "initiated_by",
                                    "created_at",
                                    "submitted_at",
                                    "evaluated_by",
                                    "evaluated_at",
                                    "evaluation_status",
                                    "status",
                                    "rejected_reason",
                                    "rejected_reasonSecond",
                                    [
                                        db.literal(`(SELECT team_name FROM teams As t WHERE t.team_id = \`challenge_response\`.\`team_id\` )`), 'team_name'
                                    ],
                                    [
                                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                                    ],
                                    [
                                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`challenge_response\`.\`evaluated_by\` )`), 'evaluated_name'
                                    ]
                                ],
                                where: {
                                    [Op.and]: [
                                        where,
                                        condition
                                    ]
                                }
                            });
                            break;
                        case 'L2':
                            data = await this.crudService.findOne(modelClass, {
                                attributes: [
                                    "challenge_response_id",
                                    "challenge_id",
                                    "theme",
                                    "state",
                                    "focus_area",
                                    "team_id",
                                    "title",
                                    "problem_statement",
                                    "causes",
                                    "effects",
                                    "community",
                                    "facing",
                                    "solution",
                                    "stakeholders",
                                    "problem_solving",
                                    "feedback",
                                    "prototype_image",
                                    "prototype_link",
                                    "workbook",
                                    "initiated_by",
                                    "created_at",
                                    "submitted_at",
                                    "evaluated_by",
                                    "evaluated_at",
                                    "evaluation_status",
                                    "status",
                                    "rejected_reason",
                                    "rejected_reasonSecond",
                                    [
                                        db.literal(`(SELECT team_name FROM teams As t WHERE t.team_id = \`challenge_response\`.\`team_id\` )`), 'team_name'
                                    ],
                                    [
                                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                                    ],
                                    [
                                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`challenge_response\`.\`evaluated_by\` )`), 'evaluated_name'
                                    ]
                                ],
                                where: {
                                    [Op.and]: [
                                        where,
                                        condition
                                    ]
                                },
                                include: {
                                    model: evaluator_rating,
                                    required: false,
                                    attributes: [
                                        'evaluator_rating_id',
                                        'evaluator_id',
                                        'challenge_response_id',
                                        'status',
                                        'level',
                                        'param_1',
                                        'param_2',
                                        'param_3',
                                        'param_4',
                                        'param_5',
                                        'comments',
                                        'overall',
                                        'submitted_at',
                                        "created_at",
                                        [
                                            db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = evaluator_ratings.created_by)`), 'rated_evaluated_name'
                                        ]
                                    ]
                                }
                            });
                            break;
                        case level != 'L1' && 'L2':
                            break;
                    }
                }
                data = await this.crudService.findOne(modelClass, {
                    attributes: [
                        "challenge_response_id",
                        "challenge_id",
                        "theme",
                        "state",
                        "focus_area",
                        "team_id",
                        "title",
                        "problem_statement",
                        "causes",
                        "effects",
                        "community",
                        "facing",
                        "solution",
                        "stakeholders",
                        "problem_solving",
                        "feedback",
                        "prototype_image",
                        "prototype_link",
                        "workbook",
                        "initiated_by",
                        "created_at",
                        "submitted_at",
                        "evaluated_by",
                        "evaluated_at",
                        "evaluation_status",
                        "status",
                        "rejected_reason",
                        "rejected_reasonSecond",
                        [
                            db.literal(`(SELECT team_name FROM teams As t WHERE t.team_id = \`challenge_response\`.\`team_id\` )`), 'team_name'
                        ],
                        [
                            db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                        ],
                        [
                            db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`challenge_response\`.\`evaluated_by\` )`), 'evaluated_name'
                        ]
                    ],
                    where: {
                        [Op.and]: [
                            where,
                            condition
                        ]
                    }
                });
            } catch (error) {
                return res.status(500).send(dispatcher(res, data, 'error'))
            }
        } else {
            try {
                if (level && typeof level == 'string') {
                    switch (level) {
                        case 'L1':
                            whereClauseStatusPart['status'] = "SUBMITTED";
                            if (yetToProcessList) {
                                if (yetToProcessList && yetToProcessList == 'L1') {
                                    whereClauseStatusPart['evaluation_status'] = {
                                        [Op.or]: [
                                            { [Op.is]: null }, ''
                                        ]
                                    }
                                }
                            }
                            responseOfFindAndCountAll = await this.crudService.findAndCountAll(modelClass, {
                                attributes: [
                                    "challenge_response_id",
                                    "challenge_id",
                                    "theme",
                                    "state",
                                    "focus_area",
                                    "team_id",
                                    "title",
                                    "problem_statement",
                                    "causes",
                                    "effects",
                                    "community",
                                    "facing",
                                    "solution",
                                    "stakeholders",
                                    "problem_solving",
                                    "feedback",
                                    "prototype_image",
                                    "prototype_link",
                                    "workbook",
                                    "initiated_by",
                                    "created_at",
                                    "submitted_at",
                                    "evaluated_by",
                                    "evaluated_at",
                                    "evaluation_status",
                                    "status",
                                    "rejected_reason",
                                    "rejected_reasonSecond",
                                    "final_result", "district",
                                    [
                                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`evaluated_by\` )`), 'evaluated_name'
                                    ],
                                    [
                                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                                    ],
                                    [
                                        db.literal(`(SELECT team_name FROM teams As t WHERE t.team_id =  \`challenge_response\`.\`team_id\` )`), 'team_name'
                                    ],
                                    [
                                        db.literal(`(SELECT JSON_ARRAYAGG(full_name) FROM  students  AS s LEFT OUTER JOIN  teams AS t ON s.team_id = t.team_id WHERE t.team_id = \`challenge_response\`.\`team_id\` )`), 'team_members'
                                    ],
                                    [
                                        db.literal(`(SELECT mentorTeamOrg.organization_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_responses\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_name'
                                    ],
                                    [
                                        db.literal(`(SELECT mentorTeamOrg.organization_code FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id = \`challenge_responses\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_code'
                                    ],
                                    [
                                        db.literal(`(SELECT full_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id WHERE challenge_responses.team_id = \`challenge_responses\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'mentor_name'
                                    ],
                                    [
                                        db.literal(`(SELECT mentorTeamOrg.category FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_responses\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'category'
                                    ]
                                ],
                                where: {
                                    [Op.and]: [
                                        condition,
                                        whereClauseStatusPart,
                                        additionalFilter,
                                    ]
                                }, limit, offset,
                            });
                            break;
                        case 'L2':
                            // cleaning up the repeated code: observation everything is same except the having groupBy clause so separating both of them based the parameter
                            let havingClausePart: any;
                            let groupByClausePart: any;
                            whereClauseStatusPart['evaluation_status'] = "SELECTEDROUND1";
                            whereClauseStatusPart['final_result'] = null;
                            if (yetToProcessList) {
                                if (yetToProcessList && yetToProcessList == 'L2') {
                                    groupByClausePart = [`challenge_response.challenge_response_id`];
                                    havingClausePart = db.Sequelize.where(db.Sequelize.fn('count', db.Sequelize.col(`evaluator_ratings.challenge_response_id`)), {
                                        [Op.lt]: baseConfig.EVAL_FOR_L2
                                    })
                                }
                            } else {
                                groupByClausePart = [`evaluator_ratings.challenge_response_id`];
                                havingClausePart = db.Sequelize.where(db.Sequelize.fn('count', db.Sequelize.col(`evaluator_ratings.challenge_response_id`)), {
                                    [Op.gte]: baseConfig.EVAL_FOR_L2
                                })
                            }
                            responseOfFindAndCountAll = await this.crudService.findAndCountAll(modelClass, {
                                attributes: [
                                    "challenge_response_id",
                                    "challenge_id",
                                    "theme",
                                    "state",
                                    "focus_area",
                                    "team_id",
                                    "title",
                                    "problem_statement",
                                    "causes",
                                    "effects",
                                    "community",
                                    "facing",
                                    "solution",
                                    "stakeholders",
                                    "problem_solving",
                                    "feedback",
                                    "prototype_image",
                                    "prototype_link",
                                    "workbook",
                                    "initiated_by",
                                    "created_at",
                                    "submitted_at",
                                    "evaluated_by",
                                    "evaluated_at",
                                    "evaluation_status",
                                    "status",
                                    "rejected_reason",
                                    "rejected_reasonSecond",
                                    "final_result", "district",
                                    [
                                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`evaluated_by\` )`), 'evaluated_name'
                                    ],
                                    [
                                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                                    ],
                                    [
                                        db.literal(`(SELECT team_name FROM teams As t WHERE t.team_id =  \`challenge_response\`.\`team_id\` )`), 'team_name'
                                    ],
                                    [
                                        db.literal(`(SELECT JSON_ARRAYAGG(full_name) FROM  students  AS s LEFT OUTER JOIN  teams AS t ON s.team_id = t.team_id WHERE t.team_id = \`challenge_response\`.\`team_id\` )`), 'team_members'
                                    ],
                                    [
                                        db.literal(`(SELECT mentorTeamOrg.organization_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_name'
                                    ],
                                    [
                                        db.literal(`(SELECT mentorTeamOrg.organization_code FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_code'
                                    ],
                                    [
                                        db.literal(`(SELECT full_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'mentor_name'
                                    ],
                                    [
                                        db.literal(`(SELECT mentorTeamOrg.category FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_responses\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'category'
                                    ]
                                ],
                                where: {
                                    [Op.and]: [
                                        condition,
                                        whereClauseStatusPart,
                                        additionalFilter,
                                    ]
                                },
                                include: [{
                                    model: evaluator_rating,
                                    where: { level: 'L2' },
                                    required: false,
                                    attributes: [
                                        [
                                            db.literal(`(SELECT  JSON_ARRAYAGG(param_1) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_1'
                                        ],
                                        [
                                            db.literal(`(SELECT  JSON_ARRAYAGG(param_2) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_2'
                                        ],
                                        [
                                            db.literal(`(SELECT  JSON_ARRAYAGG(param_3) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_3'
                                        ],
                                        [
                                            db.literal(`(SELECT  JSON_ARRAYAGG(param_4) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_4'
                                        ],
                                        [
                                            db.literal(`(SELECT  JSON_ARRAYAGG(param_5) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_5'
                                        ],
                                        [
                                            db.literal(`(SELECT  JSON_ARRAYAGG(comments) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'comments'
                                        ],
                                        [
                                            db.literal(`(SELECT  JSON_ARRAYAGG(overall) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'overall'
                                        ],
                                        [
                                            db.literal(`(SELECT ROUND(AVG(CAST(overall AS FLOAT)), 2) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'overall_avg'
                                        ],
                                        [
                                            db.literal(`(SELECT  JSON_ARRAYAGG(created_at) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'created_at'
                                        ],
                                        [
                                            db.literal(`(SELECT  JSON_ARRAYAGG(evaluator_id) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'evaluator_id'
                                        ],
                                        [
                                            db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = evaluator_ratings.created_by)`), 'rated_evaluated_name'
                                        ]
                                    ]
                                }],
                                group: groupByClausePart,
                                having: havingClausePart,
                                subQuery: false,
                                limit, offset,
                            });
                            responseOfFindAndCountAll.count = responseOfFindAndCountAll.count.length
                            break;
                        case level !== 'L1' && 'L2':
                            break;
                    }
                } else {
                    responseOfFindAndCountAll = await this.crudService.findAndCountAll(modelClass, {
                        attributes: [
                            "challenge_response_id",
                            "challenge_id",
                            "theme",
                            "state",
                            "focus_area",
                            "team_id",
                            "title",
                            "problem_statement",
                            "causes",
                            "effects",
                            "community",
                            "facing",
                            "solution",
                            "stakeholders",
                            "problem_solving",
                            "feedback",
                            "prototype_image",
                            "prototype_link",
                            "workbook",
                            "initiated_by",
                            "created_at",
                            "submitted_at",
                            "evaluated_by",
                            "evaluated_at",
                            "evaluation_status",
                            "status",
                            "rejected_reason",
                            "rejected_reasonSecond",
                            "final_result", "district",
                            [
                                db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`evaluated_by\` )`), 'evaluated_name'
                            ],
                            [
                                db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                            ],
                            [
                                db.literal(`(SELECT team_name FROM teams As t WHERE t.team_id =  \`challenge_response\`.\`team_id\` )`), 'team_name'
                            ],
                            [
                                db.literal(`(SELECT JSON_ARRAYAGG(full_name) FROM  students  AS s LEFT OUTER JOIN  teams AS t ON s.team_id = t.team_id WHERE t.team_id = \`challenge_response\`.\`team_id\` )`), 'team_members'
                            ],
                            [
                                db.literal(`(SELECT mentorTeamOrg.organization_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_name'
                            ],
                            [
                                db.literal(`(SELECT mentorTeamOrg.organization_code FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_code'
                            ],
                            [
                                db.literal(`(SELECT mentorTeamOrg.category FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'category'
                            ],
                            [
                                db.literal(`(SELECT mentorTeamOrg.district FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'district'
                            ],
                            [
                                db.literal(`(SELECT full_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'mentor_name'
                            ],
                            [
                                db.literal(`(SELECT mobile FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'mobile'
                            ]
                        ],
                        where: {
                            [Op.and]: [
                                condition,
                                whereClauseStatusPart,
                                additionalFilter,
                            ]
                        }, limit, offset,
                    });
                }
                const result = this.getPagingData(responseOfFindAndCountAll, page, limit);
                data = result;
            } catch (error: any) {
                return res.status(500).send(dispatcher(res, data, 'error'))
            }
        }
        if (!data || data instanceof Error) {
            if (data != null) {
                throw notFound(data.message)
            } else {
                throw notFound()
            }
        }
        return res.status(200).send(dispatcher(res, data, 'success'));
    };
    protected async initiateIdea(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            const challenge_id = newParamId;
            const { team_id } = newREQQuery;
            const user_id = res.locals.user_id;
            if (!challenge_id) {
                throw badRequest(speeches.CHALLENGE_ID_REQUIRED);
            }
            if (!team_id) {
                throw unauthorized(speeches.USER_TEAMID_REQUIRED)
            }
            if (!user_id) {
                throw unauthorized(speeches.UNAUTHORIZED_ACCESS);
            }
            const challengeRes = await this.crudService.findOne(challenge_response, {
                attributes: [
                    [
                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`challenge_response\`.\`initiated_by\` )`), 'initiated_by'
                    ],
                    "created_at",
                    "theme"
                ],
                where: { challenge_id, team_id }
            });
            if (challengeRes instanceof Error) {
                throw internal(challengeRes.message)
            }
            if (challengeRes) {
                return res.status(406).send(dispatcher(res, challengeRes, 'error', speeches.DATA_EXIST))
            }
            req.body.challenge_id = challenge_id,
            req.body.team_id = team_id
            req.body.created_by = user_id
            let result: any = await this.crudService.create(challenge_response, req.body);
            if (!result) {
                throw badRequest(speeches.INVALID_DATA);
            }
            if (result instanceof Error) {
                throw result;
            }
            res.status(200).send(dispatcher(res, result))
        } catch (err) {
            next(err)
        }
    }
    protected async handleAttachment(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const { team_id } = newREQQuery;
            const rawfiles: any = req.files;
            const files: any = Object.values(rawfiles);
            const allowedTypes = [
                'image/jpeg',
                'image/png',
                'application/msword',
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ];
            if (!allowedTypes.includes(files[0].type)) {
                return res.status(400).send(dispatcher(res, '', 'error', 'This file type not allowed', 400));
            }
            const errs: any = [];
            let attachments: any = [];
            let result: any = {};
            let s3 = new S3({
                apiVersion: '2006-03-01',
                region: process.env.AWS_REGION,
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            });
            if (!req.files) {
                return result;
            }
            let file_name_prefix: any;
            if (process.env.DB_HOST?.includes("prod")) {
                file_name_prefix = `ideas/${team_id}`
            } else if (process.env.DB_HOST?.includes("dev")) {
                file_name_prefix = `ideas/dev/${team_id}`
            } else {
                file_name_prefix = `ideas/stage/${team_id}`
            }
            for (const file_name of Object.keys(files)) {
                const file = files[file_name];
                const readFile: any = await fs.readFileSync(file.path);
                if (readFile instanceof Error) {
                    errs.push(`Error uploading file: ${file.originalFilename} err: ${readFile}`)
                }
                file.originalFilename = `${file_name_prefix}/${file.originalFilename}`;
                let params = {
                    Bucket: `${process.env.BUCKET}`,
                    Key: file.originalFilename,
                    Body: readFile
                };
                let options: any = { partSize: 20 * 1024 * 1024, queueSize: 2 };
                await s3.upload(params, options).promise()
                    .then((data: any) => { attachments.push(data.Location) })
                    .catch((err: any) => { errs.push(`Error uploading file: ${file.originalFilename}, err: ${err.message}`) })
                result['attachments'] = attachments;
                result['errors'] = errs;
            }
            res.status(200).send(dispatcher(res, result));
        } catch (err) {
            next(err)
        }
    }
    protected async updateAnyFields(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { model, id } = req.params;
            if (model) {
                this.model = model;
            };
            const { status,verified_status } = req.body;

            const newParamId: any = await this.authService.decryptGlobal(req.params.id);
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const { nameChange } = newREQQuery;
            let newDate = new Date();
            let newFormat = (newDate.getFullYear()) + "-" + (1 + newDate.getMonth()) + "-" + newDate.getUTCDate() + ' ' + newDate.getHours() + ':' + newDate.getMinutes() + ':' + newDate.getSeconds();
            if (status === 'SUBMITTED') {
                req.body['submitted_at'] = newFormat.trim()
                req.body.verified_status=''
                req.body.verified_at=''
                req.body.mentor_rejected_reason=''
            } else if (!nameChange) {
                req.body['submitted_at'] = ''
            }
            if (verified_status){
                req.body['verified_at'] = newFormat.trim()
            }

            const where: any = {};
            where[`${this.model}_id`] = newParamId;
            const modelLoaded = await this.loadModel(model);
            const payload = this.autoFillTrackingColumns(req, res, modelLoaded);
            const data = await this.crudService.update(modelLoaded, payload, { where: where });

            if (!data) {
                throw badRequest()
            }
            if (data instanceof Error) {
                throw data;
            }
            return res.status(200).send(dispatcher(res, data, 'updated'));
        } catch (error) {
            next(error);
        }
    }
    protected async getResponse(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            let { team_id } = newREQQuery;
            if (!team_id) {
                throw unauthorized(speeches.USER_TEAMID_REQUIRED)
            }
            let data: any;
            const where: any = {};
            where[`team_id`] = team_id;
            data = await this.crudService.findOne(challenge_response, {
                attributes: [
                    "initiated_by",
                    "submitted_at",
                    "theme",
                    "focus_area",
                    "team_id",
                    "status",
                    "others",
                    "title",
                    "problem_statement",
                    "causes",
                    "effects",
                    "community",
                    "facing",
                    "solution",
                    "stakeholders",
                    "problem_solving",
                    "feedback",
                    "prototype_image",
                    "prototype_link",
                    "workbook",
                    "verified_status",
                    "verified_at",
                    "mentor_rejected_reason",
                    "challenge_response_id",
                    [
                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                    ]
                ],
                where: {
                    [Op.and]: [
                        where
                    ]
                },
            });
            if (!data || data instanceof Error) {
                if (data != null) {
                    throw notFound(data.message)
                } else {
                    throw notFound()
                }
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    }
    protected async getResponseideapdf(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            let { team_id } = newREQQuery;
            if (!team_id) {
                throw unauthorized(speeches.USER_TEAMID_REQUIRED)
            }
            let data: any;
            const where: any = {};
            where[`team_id`] = team_id;
            data = await this.crudService.findOne(challenge_response, {
                attributes: [
                    "initiated_by",
                    "submitted_at",
                    "theme",
                    "focus_area",
                    "team_id",
                    "status",
                    "others",
                    "title",
                    "problem_statement",
                    "causes",
                    "effects",
                    "community",
                    "facing",
                    "solution",
                    "stakeholders",
                    "problem_solving",
                    "feedback",
                    "prototype_image",
                    "prototype_link",
                    "workbook",
                    "challenge_response_id",
                    "verified_status",
                    "verified_at",
                    "mentor_rejected_reason",
                    [
                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                    ],
                    [
                        db.literal(`(SELECT team_name FROM teams As t WHERE t.team_id =  \`challenge_response\`.\`team_id\` )`), 'team_name'
                    ],
                    [
                        db.literal(`(SELECT username FROM teams As t join users as u on t.user_id = u.user_id WHERE t.team_id =  \`challenge_response\`.\`team_id\` )`), 'team_username'
                    ],
                    [
                        db.literal(`(SELECT JSON_ARRAYAGG(full_name) FROM  students  AS s LEFT OUTER JOIN  teams AS t ON s.team_id = t.team_id WHERE t.team_id = \`challenge_response\`.\`team_id\` )`), 'team_members'
                    ],
                    [
                        db.literal(`(SELECT mentorTeamOrg.organization_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_name'
                    ],
                    [
                        db.literal(`(SELECT mentorTeamOrg.category FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'category'
                    ],
                    [
                        db.literal(`(SELECT mentorTeamOrg.state FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'state'
                    ],
                    [
                        db.literal(`(SELECT mentorTeamOrg.organization_code FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_code'
                    ],
                    [
                        db.literal(`(SELECT full_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'mentor_name'
                    ]
                ],
                where: {
                    [Op.and]: [
                        where
                    ]
                },
            });
            if (!data || data instanceof Error) {
                if (data != null) {
                    throw notFound(data.message)
                } else {
                    throw notFound()
                }
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    }
    protected async getRandomChallenge(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EVALUATOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let challengeResponse: any;
            let evaluator_id: any;
            let whereClause: any = {};
            let whereClauseStatusPart: any = {}
            let attributesNeedFetch: any;
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }

            let user_id = res.locals.user_id;
            if (!user_id) throw unauthorized(speeches.UNAUTHORIZED_ACCESS);

            let evaluator_user_id = newREQQuery.evaluator_user_id;
            if (!evaluator_user_id) throw unauthorized(speeches.ID_REQUIRED);

            let activeState = await this.crudService.findOne(evaluation_process, {
                attributes: ['state'], where: { [Op.and]: [{ status: 'ACTIVE' }, { level_name: 'L1' }] }
            });
            let states = activeState.dataValues.state;
            const convertToStateArray = states.split(",");
            const paramStatus: any = newREQQuery.status;
            let boolStatusWhereClauseRequired = false;

            if (paramStatus && (paramStatus in constents.challenges_flags.list)) {
                whereClauseStatusPart = { "status": paramStatus, state: { [Op.in]: convertToStateArray } };
                boolStatusWhereClauseRequired = true;
            } else {
                whereClauseStatusPart = { "status": "SUBMITTED", state: { [Op.in]: convertToStateArray } };
                boolStatusWhereClauseRequired = true;
            };

            evaluator_id = { evaluated_by: evaluator_user_id }

            let level = newREQQuery.level;
            if (level && typeof level == 'string') {
                let statesArray = states.replace(/,/g, "','")
                switch (level) {
                    case 'L1':
                        attributesNeedFetch = [
                            `challenge_response_id`,
                            `challenge_id`,
                            `others`,
                            `theme`,
                            `team_id`,
                            `title`,
                            `problem_statement`,
                            `causes`,
                            `effects`,
                            `community`,
                            `facing`,
                            `solution`,
                            `stakeholders`,
                            `problem_solving`,
                            `feedback`,
                            `prototype_image`,
                            `prototype_link`,
                            `workbook`,
                            `initiated_by`,
                            "created_at",
                            "submitted_at",
                            `status`,
                            `state`,
                            `focus_area`,
                            [
                                db.literal(`( SELECT count(*) FROM challenge_responses as idea where idea.status = 'SUBMITTED')`),
                                'overAllIdeas'
                            ],
                            [
                                db.literal(`( SELECT count(*) FROM challenge_responses as idea where idea.evaluation_status is null AND idea.status = 'SUBMITTED' AND idea.state IN ('${statesArray}'))`),
                                'openIdeas'
                            ],
                            [
                                db.literal(`(SELECT count(*) FROM challenge_responses as idea where idea.evaluated_by = ${evaluator_user_id.toString()})`), 'evaluatedIdeas'
                            ],
                        ],
                            whereClause = {
                                [Op.and]: [
                                    whereClauseStatusPart,
                                    { evaluation_status: { [Op.is]: null } }
                                ]
                            }
                        challengeResponse = await this.crudService.findOne(challenge_response, {
                            attributes: attributesNeedFetch,
                            where: whereClause,
                            order: db.literal('rand()'), limit: 1
                        });
                        if (challengeResponse instanceof Error) {
                            throw challengeResponse
                        }
                        if (!challengeResponse) {
                            throw notFound("All challenge has been accepted, no more challenge to display");
                        };
                        break;
                    case 'L2':
                        let activeState = await this.crudService.findOne(evaluation_process, {
                            attributes: ['state'], where: { [Op.and]: [{ status: 'ACTIVE' }, { level_name: 'L2' }] }
                        });
                        let states = activeState.dataValues.state
                        if (states !== null) {
                            let statesArray = states.replace(/,/g, "','")
                            challengeResponse = await db.query("SELECT challenge_responses.challenge_response_id, challenge_responses.challenge_id, challenge_responses.theme, challenge_responses.team_id, challenge_responses.title,challenge_responses.problem_statement,challenge_responses.causes,challenge_responses.effects,challenge_responses.community,challenge_responses.facing,challenge_responses.solution,challenge_responses.stakeholders,challenge_responses.problem_solving,challenge_responses.feedback,challenge_responses.prototype_image,challenge_responses.prototype_link,challenge_responses.workbook, challenge_responses.initiated_by,  challenge_responses.created_at, challenge_responses.submitted_at,    challenge_responses.status, challenge_responses.state,challenge_responses.focus_area,(SELECT COUNT(*) FROM challenge_responses AS idea WHERE idea.evaluation_status = 'SELECTEDROUND1') AS 'overAllIdeas', (SELECT COUNT(*) - SUM(CASE WHEN FIND_IN_SET('" + evaluator_user_id.toString() + "', evals) > 0 THEN 1 ELSE 0 END) FROM l1_accepted WHERE l1_accepted.state IN ('" + statesArray + "')) AS 'openIdeas', (SELECT COUNT(*) FROM evaluator_ratings AS A WHERE A.evaluator_id = " + evaluator_user_id.toString() + ") AS 'evaluatedIdeas' FROM l1_accepted AS l1_accepted LEFT OUTER JOIN challenge_responses AS challenge_responses ON l1_accepted.challenge_response_id = challenge_responses.challenge_response_id WHERE l1_accepted.state IN ('" + statesArray + "') AND NOT FIND_IN_SET(" + evaluator_user_id.toString() + ", l1_accepted.evals) ORDER BY RAND() LIMIT 1", { type: QueryTypes.SELECT });
                        } else {
                            challengeResponse = await db.query(`SELECT challenge_responses.challenge_response_id, challenge_responses.challenge_id, challenge_responses.theme, challenge_responses.team_id, challenge_responses.title,challenge_responses.problem_statement,challenge_responses.causes,challenge_responses.effects,challenge_responses.community,challenge_responses.facing,challenge_responses.solution,challenge_responses.stakeholders,challenge_responses.problem_solving,challenge_responses.feedback,challenge_responses.prototype_image,challenge_responses.prototype_link,challenge_responses.workbook, challenge_responses.initiated_by,  challenge_responses.created_at, challenge_responses.submitted_at,    challenge_responses.status, challenge_responses.state,challenge_responses.focus_area,(SELECT COUNT(*) FROM challenge_responses AS idea WHERE idea.evaluation_status = 'SELECTEDROUND1') AS 'overAllIdeas', (SELECT COUNT(*) - SUM(CASE WHEN FIND_IN_SET(${evaluator_user_id.toString()}, evals) > 0 THEN 1 ELSE 0 END) FROM l1_accepted) AS 'openIdeas', (SELECT COUNT(*) FROM evaluator_ratings AS A WHERE A.evaluator_id = ${evaluator_user_id.toString()}) AS 'evaluatedIdeas' FROM l1_accepted AS l1_accepted LEFT OUTER JOIN challenge_responses AS challenge_responses ON l1_accepted.challenge_response_id = challenge_responses.challenge_response_id WHERE NOT FIND_IN_SET(${evaluator_user_id.toString()}, l1_accepted.evals) ORDER BY RAND() LIMIT 1`, { type: QueryTypes.SELECT });
                        }
                        const evaluatedIdeas = await db.query(`SELECT COUNT(*) as evaluatedIdeas FROM evaluator_ratings AS A WHERE A.evaluator_id = ${evaluator_user_id.toString()}`, { type: QueryTypes.SELECT })
                        let throwMessage = {
                            message: 'All challenge has been rated, no more challenge to display',
                            //@ts-ignore
                            evaluatedIdeas: evaluatedIdeas[0].evaluatedIdeas
                        };
                        if (challengeResponse instanceof Error) {
                            throw challengeResponse
                        }
                        if (challengeResponse.length == 0) {
                            // throw notFound("All challenge has been rated, no more challenge to display");
                            return res.status(200).send(dispatcher(res, throwMessage, 'success'));
                        };
                        break;
                    default:
                        break;
                }
            }
            return res.status(200).send(dispatcher(res, challengeResponse, 'success'));
        } catch (error) {
            next(error);
        }
    }
    private async getChallengesForEvaluator(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EVALUATOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            let data: any = [];
            let whereClauseEvaluationStatus: any = {};
            let additionalFilter: any = {};
            let districtFilter: any = {};
            const newParamEvaluatorId = await this.authService.decryptGlobal(req.params.evaluator_id);
            const evaluator_id: any = newParamEvaluatorId
            const evaluation_status: any = newREQQuery.evaluation_status;
            const district: any = newREQQuery.district;
            const theme: any = newREQQuery.theme;
            const state: any = newREQQuery.state;
            const rejected_reason: any = newREQQuery.rejected_reason;
            const rejected_reasonSecond: any = newREQQuery.rejected_reasonSecond;
            const level: any = newREQQuery.level;
            if (!evaluator_id) {
                throw badRequest(speeches.TEAM_NAME_ID)
            };
            if (evaluation_status) {
                if (evaluation_status in constents.evaluation_status.list) {
                    whereClauseEvaluationStatus = { 'evaluation_status': evaluation_status };
                } else {
                    whereClauseEvaluationStatus['evaluation_status'] = null;
                }
            }
            if (theme) {
                additionalFilter['theme'] = theme && typeof theme == 'string' ? theme : {}
            }
            if (state) {
                additionalFilter['state'] = state && typeof state == 'string' ? state : {}
            }
            if (rejected_reason) {
                additionalFilter['rejected_reason'] = rejected_reason && typeof rejected_reason == 'string' ? rejected_reason : {}
            }
            if (rejected_reasonSecond) {
                additionalFilter['rejected_reasonSecond'] = rejected_reasonSecond && typeof rejected_reasonSecond == 'string' ? rejected_reasonSecond : {}
            }
            if (district) {
                additionalFilter['district'] = district && typeof district == 'string' ? district : {}
            }
            if (level && typeof level == 'string') {
                switch (level) {
                    case 'L1':
                        data = await this.crudService.findAll(challenge_response, {
                            attributes: [
                                "challenge_response_id",
                                "challenge_id",
                                "theme",
                                "team_id",
                                "title",
                                "problem_statement",
                                "causes",
                                "effects",
                                "community",
                                "facing",
                                "solution",
                                "stakeholders",
                                "problem_solving",
                                "feedback",
                                "prototype_image",
                                "prototype_link",
                                "workbook",
                                "initiated_by",
                                "created_at",
                                "submitted_at",
                                "evaluated_by",
                                "evaluated_at",
                                "evaluation_status",
                                "status",
                                "rejected_reason",
                                "rejected_reasonSecond",
                                "final_result", "district",
                                "state",
                                "focus_area",
                                [
                                    db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`evaluated_by\` )`), 'evaluated_name'
                                ],
                                [
                                    db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                                ],
                                [
                                    db.literal(`(SELECT team_name FROM teams As t WHERE t.team_id =  \`challenge_response\`.\`team_id\` )`), 'team_name'
                                ],
                                [
                                    db.literal(`(SELECT JSON_ARRAYAGG(full_name) FROM  students  AS s LEFT OUTER JOIN  teams AS t ON s.team_id = t.team_id WHERE t.team_id = \`challenge_response\`.\`team_id\` )`), 'team_members'
                                ],
                                [
                                    db.literal(`(SELECT mentorTeamOrg.organization_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_name'
                                ],
                                [
                                    db.literal(`(SELECT mentorTeamOrg.organization_code FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_code'
                                ],
                                [
                                    db.literal(`(SELECT full_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'mentor_name'
                                ]
                            ],
                            where: {
                                [Op.and]: [
                                    { evaluated_by: evaluator_id },
                                    whereClauseEvaluationStatus,
                                    additionalFilter,
                                ]
                            }
                        });
                        break;
                    case 'L2': {
                        data = await this.crudService.findAll(challenge_response, {
                            attributes: [
                                "challenge_response_id",
                                "challenge_id",
                                "theme",
                                "team_id",
                                "title",
                                "problem_statement",
                                "causes",
                                "effects",
                                "community",
                                "facing",
                                "solution",
                                "stakeholders",
                                "problem_solving",
                                "feedback",
                                "prototype_image",
                                "prototype_link",
                                "workbook",
                                "initiated_by",
                                "created_at",
                                "submitted_at",
                                "evaluated_by",
                                "evaluated_at",
                                "evaluation_status",
                                "status",
                                "rejected_reason",
                                "rejected_reasonSecond",
                                "final_result", "district",
                                "state",
                                "focus_area",
                                [
                                    db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`evaluated_by\` )`), 'evaluated_name'
                                ],
                                [
                                    db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                                ],
                                [
                                    db.literal(`(SELECT team_name FROM teams As t WHERE t.team_id =  \`challenge_response\`.\`team_id\` )`), 'team_name'
                                ],
                                [
                                    db.literal(`(SELECT JSON_ARRAYAGG(full_name) FROM  students  AS s LEFT OUTER JOIN  teams AS t ON s.team_id = t.team_id WHERE t.team_id = \`challenge_response\`.\`team_id\` )`), 'team_members'
                                ],
                                [
                                    db.literal(`(SELECT mentorTeamOrg.organization_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_name'
                                ],
                                [
                                    db.literal(`(SELECT mentorTeamOrg.organization_code FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_code'
                                ],
                                [
                                    db.literal(`(SELECT full_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'mentor_name'
                                ]
                            ],
                            where: {
                                [Op.and]: [
                                    whereClauseEvaluationStatus,
                                    additionalFilter,
                                    db.literal('`evaluator_ratings`.`evaluator_id` =' + JSON.stringify(evaluator_id)),
                                ]
                            },
                            include: [{
                                model: evaluator_rating,
                                required: false,
                                where: { evaluator_id },
                                attributes: [
                                    'evaluator_rating_id',
                                    'evaluator_id',
                                    'challenge_response_id',
                                    'status',
                                    'level',
                                    'param_1',
                                    'param_2',
                                    'param_3',
                                    'param_4',
                                    'param_5',
                                    'comments',
                                    'overall',
                                    'submitted_at',
                                    "created_at"
                                ]
                            }],
                        });
                    }
                }
            }
            if (!data) {
                throw badRequest(data.message)
            };
            if (data instanceof Error) {
                throw data;
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error)
        }
    };
    private async finalEvaluation(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let user_id = res.locals.user_id;
            if (!user_id) {
                throw unauthorized(speeches.UNAUTHORIZED_ACCESS)
            }
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            let key: any = newREQQuery.key;
            let data: any;
            const paramStatus: any = newREQQuery.status;
            const district: any = newREQQuery.district;
            const theme: any = newREQQuery.theme;
            const level: any = newREQQuery.level;
            const { page, size } = newREQQuery;
            const { limit, offset } = this.getPagination(page, size);
            const where: any = {};
            let whereClauseStatusPart: any = {}
            let additionalFilter: any = {};
            let districtFilter: any = {};
            let boolStatusWhereClauseEvaluationStatusRequired = false;
            //status filter
            if (paramStatus && (paramStatus in constents.challenges_flags.list)) {
                whereClauseStatusPart = { "status": paramStatus };
                boolStatusWhereClauseEvaluationStatusRequired = true;
            } else if (paramStatus === 'ALL') {
                whereClauseStatusPart = {};
                boolStatusWhereClauseEvaluationStatusRequired = false;
            } else {
                whereClauseStatusPart = { "evaluation_status": "SELECTEDROUND1" };
                boolStatusWhereClauseEvaluationStatusRequired = true;
            };
            if (key) {
                whereClauseStatusPart["final_result"] = key
            } else {
                whereClauseStatusPart["final_result"] = '0'
            }
            if (theme) {
                whereClauseStatusPart["theme"] = theme && typeof theme == 'string' ? theme : {}
            }
            if (district) {
                whereClauseStatusPart["district"] = district && typeof district == 'string' ? district : {}
            };
            if (level) {
                where["levelWhere"] = level && typeof level == 'string' ? { level } : {}
                where["liter"] = level ? db.literal('`challenge_response->evaluator_ratings`.`level` = ' + JSON.stringify(level)) : {}
            }
            data = await this.crudService.findAll(challenge_response, {
                attributes: [
                    "challenge_response_id",
                    "challenge_id",
                    "theme",
                    "team_id",
                    "title",
                    "problem_statement",
                    "causes",
                    "effects",
                    "community",
                    "facing",
                    "solution",
                    "stakeholders",
                    "problem_solving",
                    "feedback",
                    "prototype_image",
                    "prototype_link",
                    "workbook",
                    "initiated_by",
                    "created_at",
                    "submitted_at",
                    "evaluated_by",
                    "evaluated_at",
                    "evaluation_status",
                    "status",
                    "rejected_reason",
                    "rejected_reasonSecond",
                    "final_result", "district", "state", "focus_area",
                    [
                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`evaluated_by\` )`), 'evaluated_name'
                    ],
                    [
                        db.literal(`(SELECT full_name FROM users As s WHERE s.user_id =  \`challenge_response\`.\`initiated_by\` )`), 'initiated_name'
                    ],
                    [
                        db.literal(`(SELECT team_name FROM teams As t WHERE t.team_id =  \`challenge_response\`.\`team_id\` )`), 'team_name'
                    ],
                    [
                        db.literal(`(SELECT JSON_ARRAYAGG(full_name) FROM  students  AS s LEFT OUTER JOIN  teams AS t ON s.team_id = t.team_id WHERE t.team_id = \`challenge_response\`.\`team_id\` )`), 'team_members'
                    ],
                    [
                        db.literal(`(SELECT mentorTeamOrg.organization_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_name'
                    ],
                    [
                        db.literal(`(SELECT mentorTeamOrg.organization_code FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'organization_code'
                    ],
                    [
                        db.literal(`(SELECT full_name FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id WHERE challenge_responses.team_id = \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'mentor_name'
                    ],
                    [
                        db.literal(`(SELECT mentorTeamOrg.category FROM challenge_responses AS challenge_responses LEFT OUTER JOIN teams AS team ON challenge_response.team_id = team.team_id LEFT OUTER JOIN mentors AS mentorTeam ON team.mentor_id = mentorTeam.mentor_id LEFT OUTER JOIN organizations AS mentorTeamOrg ON mentorTeam.organization_code = mentorTeamOrg.organization_code WHERE challenge_responses.team_id =  \`challenge_response\`.\`team_id\` GROUP BY challenge_response.team_id)`), 'category'
                    ]
                ],
                where: {
                    [Op.and]: [
                        whereClauseStatusPart,
                        where.liter,
                    ]
                },
                include: [{
                    model: evaluator_rating,
                    where: where,
                    required: false,
                    attributes: [
                        [
                            db.literal(`(SELECT  JSON_ARRAYAGG(param_1) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_1'
                        ],
                        [
                            db.literal(`(SELECT ROUND(AVG(CAST(param_1 AS FLOAT)), 2) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_1_avg'
                        ],
                        [
                            db.literal(`(SELECT  JSON_ARRAYAGG(param_2) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_2'
                        ],
                        [
                            db.literal(`(SELECT ROUND(AVG(CAST(param_2 AS FLOAT)), 2) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_2_avg'
                        ],
                        [
                            db.literal(`(SELECT  JSON_ARRAYAGG(param_3) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_3'
                        ],
                        [
                            db.literal(`(SELECT ROUND(AVG(CAST(param_3 AS FLOAT)), 2) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_3_avg'
                        ],

                        [
                            db.literal(`(SELECT  JSON_ARRAYAGG(param_4) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_4'
                        ],
                        [
                            db.literal(`(SELECT ROUND(AVG(CAST(param_4 AS FLOAT)), 2) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_4_avg'
                        ],
                        [
                            db.literal(`(SELECT  JSON_ARRAYAGG(param_5) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_5'
                        ],
                        [
                            db.literal(`(SELECT ROUND(AVG(CAST(param_5 AS FLOAT)), 2) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'param_5_avg'
                        ],
                        [
                            db.literal(`(SELECT  JSON_ARRAYAGG(comments) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'comments'
                        ],
                        [
                            db.literal(`(SELECT  JSON_ARRAYAGG(overall) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'overall'
                        ],
                        [
                            db.literal(`(SELECT ROUND(AVG(CAST(overall AS FLOAT)), 2) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'overall_avg'
                        ],
                        [
                            db.literal(`(SELECT  JSON_ARRAYAGG(created_at) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'created_at'
                        ],
                        [
                            db.literal(`(SELECT  JSON_ARRAYAGG(evaluator_id) FROM  evaluator_ratings as rating WHERE rating.challenge_response_id = \`challenge_response\`.\`challenge_response_id\`)`), 'evaluator_id'
                        ],
                        // [
                        //     db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = evaluator_ratings.created_by)`), 'rated_evaluated_name'
                        // ]
                    ]
                }], limit, offset, subQuery: false
            });
            if (!data) {
                throw badRequest(data.message)
            };
            if (data instanceof Error) {
                throw data;
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error: any) {
            return res.status(500).send(dispatcher(res, error, 'error'))
        }
    };
    protected async getideastatusbyteamid(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const teamId = newREQQuery.team_id;
            const result = await db.query(`select  ifnull((select status  FROM challenge_responses where team_id = ${teamId}),'No Idea')ideaStatus`, { type: QueryTypes.SELECT });
            res.status(200).send(dispatcher(res, result, "success"))
        } catch (error) {
            next(error);
        }
    }
    protected async getSchoolPdfIdeaStatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        let newREQQuery: any = {}
        if (req.query.Data) {
            let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
            newREQQuery = JSON.parse(newQuery);
        } else if (Object.keys(req.query).length !== 0) {
            return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
        }
        try {
            const result = await db.query(`SELECT 
            teams.team_id,
            team_name,
            ch.status AS ideaStatus,
            ch.verified_status,
            ch.evaluation_status,
            ch.final_result
        FROM
            teams
                LEFT JOIN
            challenge_responses AS ch ON teams.team_id = ch.team_id
        WHERE
            mentor_id = ${newREQQuery.mentor_id}
        GROUP BY teams.team_id;`, { type: QueryTypes.SELECT });
            res.status(200).send(dispatcher(res, result, "success"))
        } catch (error) {
            next(error);
        }
    }
} 