import { Request, Response, NextFunction } from "express";
import { Op, QueryTypes } from "sequelize";
import { constents } from "../configs/constents.config";
import { teamSchema, teamUpdateSchema, teamChangePasswordSchema, teamLoginSchema } from "../validations/team.validationa";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import authService from '../services/auth.service';
import db from "../utils/dbconnection.util"
import dispatcher from "../utils/dispatch.util";
import { badRequest, forbidden, notFound } from "boom";
import { speeches } from "../configs/speeches.config";
import { team } from "../models/team.model";
import { student } from "../models/student.model";
import { user } from "../models/user.model";
import { mentor } from "../models/mentor.model";
import { challenge_response } from "../models/challenge_response.model";
import validationMiddleware from "../middlewares/validation.middleware";
import { organization } from "../models/organization.model";

export default class TeamController extends BaseController {

    model = "team";
    authService: authService = new authService;
    protected initializePath(): void {
        this.path = '/teams';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(teamSchema, teamUpdateSchema);
    }
    protected initializeRoutes(): void {
        //example route to add 
        this.router.get(`${this.path}/:id/members`, this.getTeamMembers.bind(this));
        this.router.get(`${this.path}/list`, this.getTeamsByMenter.bind(this));
        this.router.get(`${this.path}/namebymenterid`, this.getNameByMenter.bind(this));
        this.router.get(`${this.path}/listwithideaStatus`, this.getteamslistwithideastatus.bind(this));
        this.router.post(`${this.path}/login`, validationMiddleware(teamLoginSchema), this.login.bind(this));
        super.initializeRoutes();
    }
    private async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        let teamDetails: any;
        let result;
        req.body['role'] = 'TEAM'
        result = await this.authService.login(req.body);
        if (!result) {
            return res.status(404).send(dispatcher(res, result, 'error', speeches.USER_NOT_FOUND));
        } else if (result.error) {
            return res.status(401).send(dispatcher(res, result.error, 'error', speeches.USER_RISTRICTED, 401));
        } else {
            teamDetails = await this.authService.getServiceDetails('team', { user_id: result.data.user_id });
            result.data['team_id'] = teamDetails.dataValues.team_id;
            result.data['mentor_id'] = teamDetails.dataValues.mentor_id;
            result.data['team_name'] = teamDetails.dataValues.team_name;
            result.data['team_email'] = teamDetails.dataValues.team_email;

            const mentorData = await this.authService.crudService.findOne(mentor, {
                where: { mentor_id: teamDetails.dataValues.mentor_id },
                include: {
                    model: organization
                }
            });
            if (!mentorData || mentorData instanceof Error) {
                return res.status(404).send(dispatcher(res, null, 'error', speeches.USER_REG_STATUS));
            }
            if (mentorData.dataValues.reg_status !== '3') {
                return res.status(404).send(dispatcher(res, null, 'error', speeches.USER_REG_STATUS));
            }
            result.data['Teacher_name'] = mentorData.dataValues.full_name;
            result.data['organization_name'] = mentorData.dataValues.organization.organization_name;
            result.data['district'] = mentorData.dataValues.organization.district;
            result.data['state'] = mentorData.dataValues.organization.state;
            return res.status(200).send(dispatcher(res, result.data, 'success', speeches.USER_LOGIN_SUCCESS));
        }
    }
    protected async getData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let data: any;
            const { model, id } = req.params;
            if (model) {
                this.model = model;
            };
            const current_user = res.locals.user_id || res.locals.id || res.locals.state_coordinators_id;
            if (!current_user) {
                throw forbidden()
            }
            // pagination
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            let mentor_id: any = null
            const { page, size, } = newREQQuery;
            mentor_id = newREQQuery.mentor_id
            // let condition = title ? { title: { [Op.like]: `%${title}%` } } : null;
            let condition = null;
            if (mentor_id) {
                const getUserIdFromMentorId = await mentor.findOne({
                    attributes: ["user_id", "created_by"],
                    where: {
                        mentor_id: mentor_id
                    }
                });
                if (!getUserIdFromMentorId) throw badRequest(speeches.MENTOR_NOT_EXISTS);
                if (getUserIdFromMentorId instanceof Error) throw getUserIdFromMentorId;
                const providedMentorsUserId = getUserIdFromMentorId.getDataValue("user_id");
                condition = {
                    mentor_id: mentor_id,
                    created_by: providedMentorsUserId
                }
                // if (current_user !== getUserIdFromMentorId.getDataValue("user_id")) {
                //     throw forbidden();
                // };
            }

            const { limit, offset } = this.getPagination(page, size);
            const modelClass = await this.loadModel(model).catch(error => {
                next(error)
            });
            const where: any = {};
            const paramStatus: any = newREQQuery.status;
            let whereClauseStatusPart: any = {};
            let whereClauseStatusPartLiteral = "1=1";
            let addWhereClauseStatusPart = false
            if (paramStatus && (paramStatus in constents.common_status_flags.list)) {
                whereClauseStatusPart = { "status": paramStatus }
                whereClauseStatusPartLiteral = `status = "${paramStatus}"`
                addWhereClauseStatusPart = true;
            }
            //attributes separating for challenge submission;
            let attributesNeeded: any = [];
            const ideaStatus = newREQQuery.ideaStatus;
            if (ideaStatus && ideaStatus == 'true') {
                attributesNeeded = [
                    'team_name',
                    'team_id',
                    'mentor_id',
                    'status',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                    [
                        db.literal(`(
                            SELECT COUNT(*)
                            FROM students AS s
                            WHERE
                                ${addWhereClauseStatusPart ? "s." + whereClauseStatusPartLiteral : whereClauseStatusPartLiteral}
                            AND
                                s.team_id = \`team\`.\`team_id\`
                        )`), 'student_count'
                    ],
                    [
                        db.literal(`(
                            SELECT status
                            FROM challenge_responses AS idea
                            WHERE idea.team_id = \`team\`.\`team_id\`
                        )`), 'ideaStatus'
                    ],
                    [
                        db.literal(`(
                            SELECT challenge_response_id
                            FROM challenge_responses AS idea
                            WHERE idea.team_id = \`team\`.\`team_id\`
                        )`), 'challenge_response_id'
                    ]
                ]
            } else {
                attributesNeeded = [
                    'team_name',
                    'team_id',
                    'team_email',
                    'mentor_id',
                    'status',
                    'created_at',
                    'created_by',
                    'updated_at',
                    'updated_by',
                    [
                        db.literal(`(
                            SELECT COUNT(*)
                            FROM students AS s
                            WHERE
                                ${addWhereClauseStatusPart ? "s." + whereClauseStatusPartLiteral : whereClauseStatusPartLiteral}
                            AND
                                s.team_id = \`team\`.\`team_id\`
                        )`), 'student_count'
                    ],
                    [
                        db.literal(`(
                            SELECT status
                            FROM challenge_responses AS idea
                            WHERE idea.team_id = \`team\`.\`team_id\`
                        )`), 'ideaStatus'
                    ]
                ]
            }
            let state: any = newREQQuery.state;
            let stateFilter: any = {}
            if (state) {
                stateFilter['whereClause'] = state && typeof state == 'string' && state !== 'All States' ? { state } : {}
                stateFilter["liter"] = state && typeof state == 'string' && state !== 'All States' ? db.literal('`mentor->organization`.`state` = ' + JSON.stringify(state)) : {}
            }
            if (id) {
                const newParamId: any = await this.authService.decryptGlobal(req.params.id);
                where[`${this.model}_id`] = JSON.parse(newParamId);
                data = await this.crudService.findOne(modelClass, {
                    attributes: [
                        'team_name',
                        'team_id',
                        'mentor_id',
                        'status',
                        'created_at',
                        'created_by',
                        'updated_at',
                        'updated_by',
                        [
                            db.literal(`(
                            SELECT COUNT(*)
                            FROM students AS s
                            WHERE
                                ${addWhereClauseStatusPart ? "s." + whereClauseStatusPartLiteral : whereClauseStatusPartLiteral}
                            AND
                                s.team_id = \`team\`.\`team_id\`
                        )`), 'student_count'
                        ]
                    ],
                    where: {
                        [Op.and]: [
                            whereClauseStatusPart,
                            where,
                        ]
                    }
                });
            } else {
                try {
                    const responseOfFindAndCountAll = await this.crudService.findAndCountAll(modelClass, {
                        attributes: attributesNeeded,
                        where: {
                            [Op.and]: [
                                whereClauseStatusPart,
                                condition,
                                stateFilter.liter
                            ]
                        },
                        include: [
                            {
                                model: mentor,
                                attributes: [
                                    'mentor_id',
                                    'full_name'
                                ],
                                include: {
                                    where: stateFilter.whereClause,
                                    required: false,
                                    model: organization,
                                    attributes: [
                                        "organization_name",
                                        'organization_code',
                                        "unique_code",
                                        "pin_code",
                                        "category",
                                        "city",
                                        "district",
                                        "state",
                                        'address'
                                    ]
                                }

                            },
                            {
                                model: user,
                                attributes: [
                                    'username'
                                ]
                            }
                        ], limit, offset,
                        order: [["created_at", "DESC"]],
                    })
                    const result = this.getPagingData(responseOfFindAndCountAll, page, limit);
                    data = result;
                } catch (error: any) {
                    return res.status(500).send(dispatcher(res, data, 'error'))
                }

            }
            // if (!data) {
            //     return res.status(404).send(dispatcher(res,data, 'error'));
            // }
            if (!data || data instanceof Error) {
                if (data != null) {
                    throw notFound(data.message)
                } else {
                    throw notFound()
                }
                res.status(200).send(dispatcher(res, null, "error", speeches.DATA_NOT_FOUND));
                // if(data!=null){
                //     throw 
                (data.message)
                // }else{
                //     throw notFound()
                // }
            }

            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    };
    protected async getTeamMembers(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        // accept the team_id from the params and find the students details, user_id
        const newParamId: any = await this.authService.decryptGlobal(req.params.id);
        const team_id = JSON.parse(newParamId);
        if (!team_id || team_id === "") {
            return res.status(400).send(dispatcher(res, null, 'error', speeches.TEAM_NAME_ID));
        }
        const team_res = await this.crudService.findOne(team, { where: { team_id } });
        if (!team_res) {
            return res.status(400).send(dispatcher(res, null, 'error', speeches.TEAM_NOT_FOUND));
        }
        const where: any = { team_id };
        let whereClauseStatusPart: any = {};
        let newREQQuery: any = {}
        if (req.query.Data) {
            let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
            newREQQuery = JSON.parse(newQuery);
        } else if (Object.keys(req.query).length !== 0) {
            return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
        }
        const paramStatus: any = newREQQuery.status;
        if (paramStatus && (paramStatus in constents.common_status_flags.list)) {
            whereClauseStatusPart = { "status": paramStatus }
        }
        const student_res = await this.crudService.findAll(student, {
            where: {
                [Op.and]: [
                    whereClauseStatusPart,
                    where
                ],
            }, include: [{
                required: false,
                model: user,
                attributes: ["username"]
            }]
        });
        return res.status(200).send(dispatcher(res, student_res, 'success'));
    };
    /**
     * 
     * Add check to see if team with same name and same mentor doesnt exits only then creeate a team 
     * @param req 
     * @param res 
     * @param next 
     * @returns 
     */
    protected async createData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { model } = req.params;
            if (model) {
                this.model = model;
            };
            const current_user = res.locals.user_id;
            const modelLoaded = await this.loadModel(model);
            const getUserIdFromMentorId = await mentor.findOne({
                attributes: ["user_id", "created_by"], where: { mentor_id: req.body.mentor_id }
            });

            if (!getUserIdFromMentorId) throw badRequest(speeches.MENTOR_NOT_EXISTS);
            if (getUserIdFromMentorId instanceof Error) throw getUserIdFromMentorId;
            if (current_user !== getUserIdFromMentorId.getDataValue("user_id")) {
                throw forbidden();
            };
            const payload = this.autoFillTrackingColumns(req, res, modelLoaded);

            const teamNameCheck: any = await team.findOne({
                where: {
                    mentor_id: payload.mentor_id,
                    team_name: payload.team_name
                }
            });
            if (teamNameCheck) {
                throw badRequest('code unique');
            }

            // add check if teamNameCheck is not an error and has data then return and err
            const findOrgCode = await db.query(`SELECT COALESCE(MAX(team_id), 0) AS team_id FROM Aim_db.teams;`, { type: QueryTypes.SELECT });
            const countINcrement = parseInt(Object.values(findOrgCode[0]).toString(), 10) + 1;
            const paddingvalue = countINcrement.toString().padStart(5, '0')
            let password = payload.team_name.replace(/\s/g, '');
            const cryptoEncryptedString = await this.authService.generateCryptEncryption(password.toLowerCase());
            payload['username'] = `SIM${paddingvalue}`
            payload['full_name'] = payload.team_name
            payload['password'] = cryptoEncryptedString
            payload['role'] = "TEAM"
            const data = await this.authService.register(payload);
            if (!data) {
                return res.status(404).send(dispatcher(res, data, 'error'));
            }
            if (!data) {
                throw badRequest()
            }
            if (data instanceof Error) {
                throw data;
            }
            return res.status(201).send(dispatcher(res, data, 'created'));

        } catch (error) {
            next(error);
        }
    }
    protected async deleteData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let deletingTeamDetails: any;
            let deletingChallengeDetails: any;
            let deletingTeamuserDetails: any;
            let deleteTeam: any = 1;
            const { model, id } = req.params;
            if (model) {
                this.model = model;
            };
            const where: any = {};
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            where[`${this.model}_id`] = newParamId;
            const getTeamDetails = await this.crudService.findOne(await this.loadModel(model), {
                attributes: ["team_id", "mentor_id", "user_id"],
                where
            });
            if (getTeamDetails instanceof Error) throw getTeamDetails;
            if (!getTeamDetails) throw notFound(speeches.TEAM_NOT_FOUND);
            const getStudentDetails = await this.crudService.findAll(student, {
                attributes: ["student_id", "user_id"],
                where: { team_id: getTeamDetails.dataValues.team_id }
            });
            if (getStudentDetails instanceof Error) throw getTeamDetails;
            if (getStudentDetails) {
                for (let student of getStudentDetails) {
                    const deleteUserStudentAndRemoveAllResponses = await this.authService.deleteStudentAndStudentResponse(student.dataValues.user_id);
                    deleteTeam++;
                    // deletingTeamDetails = await this.crudService.delete(await this.loadModel(model), { where: where });
                }
            };
            if (deleteTeam >= 1) {
                deletingChallengeDetails = await this.crudService.delete(challenge_response, { where: { team_id: getTeamDetails.dataValues.team_id } });
                deletingTeamDetails = await this.crudService.delete(await this.loadModel(model), { where: where });
                deletingTeamuserDetails = await this.crudService.delete(user, { where: { user_id: getTeamDetails.dataValues.user_id } })
            }
            return res.status(200).send(dispatcher(res, deletingTeamDetails, 'deleted'));
            //         if (exist(team_id))
            //             if (check students)
            // 		bulk delete
            // Delete teams
            // 	else
            // 		Delete teams
            // else
            //    No action
            // if (!data) {
            //     throw badRequest()
            // }
            // if (data instanceof Error) {
            //     throw data
            // }
        } catch (error) {
            next(error);
        }
    }
    protected async getTeamsByMenter(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR') {
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
            const mentorId = newREQQuery.mentor_id;
            const result = await db.query(`SELECT teams.team_id,team_email,team_name,(select username from users where user_id = teams.user_id) as username, COUNT(students.team_id) as StudentCount FROM teams left JOIN students ON teams.team_id = students.team_id where mentor_id = ${mentorId} GROUP BY teams.team_id order by team_id desc`, { type: QueryTypes.SELECT });
            res.status(200).send(dispatcher(res, result, "success"))
        } catch (error) {
            next(error);
        }
    }
    protected async getNameByMenter(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            const mentorId = newREQQuery.mentor_id;
            const result = await db.query(`SELECT team_id,team_name FROM teams where mentor_id = ${mentorId} order by team_id desc;`, { type: QueryTypes.SELECT });
            res.status(200).send(dispatcher(res, result, "success"))
        } catch (error) {
            next(error);
        }
    }
    protected async getteamslistwithideastatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR') {
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
            const mentorId = newREQQuery.mentor_id;
            const result = await db.query(`SELECT teams.team_id,team_name,COUNT(teams.team_id) AS StudentCount,challenge_responses.status AS ideaStatus
            FROM
                teams
                    LEFT JOIN
                students ON teams.team_id = students.team_id
                    LEFT JOIN
                challenge_responses ON teams.team_id = challenge_responses.team_id
            WHERE
                mentor_id = ${mentorId}
            GROUP BY teams.team_id;`, { type: QueryTypes.SELECT });
            res.status(200).send(dispatcher(res, result, "success"))
        } catch (error) {
            next(error);
        }
    }
}