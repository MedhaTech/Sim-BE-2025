import bcrypt from 'bcrypt';
import axios from 'axios';
import fs from 'fs';
import * as csv from "fast-csv";
import { Op, QueryTypes } from 'sequelize';
import { Request, Response, NextFunction } from 'express';
import { customAlphabet } from 'nanoid';
import { speeches } from '../configs/speeches.config';
import { baseConfig } from '../configs/base.config';
import { user } from '../models/user.model';
import db from "../utils/dbconnection.util"
import { mentorRegSchema, mentorSchema, mentorUpdateSchema } from '../validations/mentor.validationa';
import dispatcher from '../utils/dispatch.util';
import authService from '../services/auth.service';
import BaseController from './base.controller';
import ValidationsHolder from '../validations/validationHolder';
import { badRequest, forbidden, internal, notFound } from 'boom';
import { mentor } from '../models/mentor.model';
import { where } from 'sequelize/types';
import { team } from '../models/team.model';
import { student } from '../models/student.model';
import { constents } from '../configs/constents.config';
import { organization } from '../models/organization.model';
import validationMiddleware from '../middlewares/validation.middleware';
import { badge } from '../models/badge.model';

export default class MentorController extends BaseController {
    model = "mentor";
    authService: authService = new authService;
    private password = process.env.GLOBAL_PASSWORD;
    private nanoid = customAlphabet('0123456789', 6);
    protected initializePath(): void {
        this.path = '/mentors';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(mentorSchema, mentorUpdateSchema);
    }
    protected initializeRoutes(): void {
        //example route to add
        //this.router.get(`${this.path}/`, this.getData);
        this.router.post(`${this.path}/register`, validationMiddleware(mentorRegSchema), this.register.bind(this));
        this.router.post(`${this.path}/login`, this.login.bind(this));
        this.router.get(`${this.path}/logout`, this.logout.bind(this));
        this.router.put(`${this.path}/changePassword`, this.changePassword.bind(this));
        this.router.delete(`${this.path}/:mentor_user_id/deleteAllData`, this.deleteAllData.bind(this));
        this.router.put(`${this.path}/resetPassword`, this.resetPassword.bind(this));
        this.router.post(`${this.path}/emailOtp`, this.emailOtp.bind(this));
        this.router.get(`${this.path}/mentorpdfdata`, this.mentorpdfdata.bind(this));
        this.router.post(`${this.path}/triggerWelcomeEmail`, this.triggerWelcomeEmail.bind(this));
        this.router.post(`${this.path}/:mentor_user_id/badges`, this.addBadgeToMentor.bind(this));
        this.router.get(`${this.path}/:mentor_user_id/badges`, this.getMentorBadges.bind(this));
        this.router.get(`${this.path}/teamCredentials/:mentorId`, this.getteamCredentials.bind(this));

        super.initializeRoutes();
    }
    protected async autoFillUserDataForBulkUpload(req: Request, res: Response, modelLoaded: any, reqData: any = null) {
        let payload = reqData;
        if (modelLoaded.rawAttributes.user_id !== undefined) {
            const userData = await this.crudService.create(user, { username: reqData.username, ...reqData });
            payload['user_id'] = userData.dataValues.user_id;
        }
        if (modelLoaded.rawAttributes.created_by !== undefined) {
            payload['created_by'] = res.locals.user_id;
        }
        if (modelLoaded.rawAttributes.updated_by !== undefined) {
            payload['updated_by'] = res.locals.user_id;
        }
        return payload;
    }
    //TODO: Override the getDate function for mentor and join org details and user details
    protected async getData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
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
            const paramStatus: any = newREQQuery.status;
            if (model) {
                this.model = model;
            };
            // const current_user = res.locals.user_id; 
            // pagination
            const { page, size, status } = newREQQuery;
            // let condition = status ? { status: { [Op.like]: `%${status}%` } } : null;
            const { limit, offset } = this.getPagination(page, size);
            const modelClass = await this.loadModel(model).catch(error => {
                next(error)
            });
            const where: any = {};
            let whereClauseStatusPart: any = {};
            let boolStatusWhereClauseRequired = false;
            if (paramStatus && (paramStatus in constents.common_status_flags.list)) {
                if (paramStatus === 'ALL') {
                    whereClauseStatusPart = {};
                    boolStatusWhereClauseRequired = false;
                } else {
                    whereClauseStatusPart = { "status": paramStatus };
                    boolStatusWhereClauseRequired = true;
                }
            } else {
                whereClauseStatusPart = { "status": "ACTIVE" };
                boolStatusWhereClauseRequired = true;
            };
            // const getUserIdFromMentorId = await mentor.findOne({
            //     attributes: ["user_id", "created_by"], where: { mentor_id: req.body.mentor_id }
            // });
            // console.log(getUserIdFromMentorId);
            // if (!getUserIdFromMentorId) throw badRequest(speeches.MENTOR_NOT_EXISTS);
            // if (getUserIdFromMentorId instanceof Error) throw getUserIdFromMentorId;
            // if (current_user !== getUserIdFromMentorId.getDataValue("user_id")) {
            //     throw forbidden();
            // };
            let state: any = newREQQuery.state;
            let whereClauseOfState: any = state && state !== 'All States' ?
                { state: { [Op.like]: newREQQuery.state } } :
                { state: { [Op.like]: `%%` } }
            if (id) {
                const deValue: any = await this.authService.decryptGlobal(req.params.id);
                where[`${this.model}_id`] = JSON.parse(deValue);
                data = await this.crudService.findOne(modelClass, {
                    attributes: {
                        include: [
                            [
                                db.literal(`( SELECT username FROM users AS u WHERE u.user_id = \`mentor\`.\`user_id\`)`), 'username_email'
                            ]
                        ]
                    },
                    where: {
                        [Op.and]: [
                            whereClauseStatusPart,
                            where,
                        ]
                    },
                    include: {
                        model: organization,
                        attributes: [
                            "organization_code",
                            "organization_name",
                            "organization_id",
                            "principal_name",
                            "principal_mobile",
                            "principal_email",
                            "city",
                            "district",
                            "state",
                            "country",
                            "category",
                            "pin_code",
                            "unique_code",
                            "new_district"
                        ]
                    },
                });
            } else {
                try {
                    const responseOfFindAndCountAll = await this.crudService.findAndCountAll(modelClass, {
                        attributes: {
                            attributes: [
                                "mentor_id",
                                "user_id",
                                "full_name",
                                "otp",
                                "mobile",
                            ],
                            include: [
                                [
                                    db.literal(`( SELECT username FROM users AS u WHERE u.user_id = \`mentor\`.\`user_id\`)`), 'username'
                                ]
                            ],
                        },
                        where: {
                            [Op.and]: [
                                whereClauseStatusPart,
                                // condition
                            ]
                        },
                        include: {
                            model: organization,
                            attributes: [
                                "organization_code",
                                "organization_name",
                                "organization_id",
                                "district",
                                "category",
                                "state"
                            ], where: whereClauseOfState,
                            require: false
                        }, limit, offset
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
    }
    protected async updateData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { model, id } = req.params;
            if (model) {
                this.model = model;
            };
            const user_id = res.locals.user_id
            const where: any = {};
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            where[`${this.model}_id`] = newParamId;
            const modelLoaded = await this.loadModel(model);
            
            if (req.body.username) {
                var pass = req.body.username.trim();
                var myArray = pass.split("@");
                const cryptoEncryptedString = await this.authService.generateCryptEncryption(myArray[0]);
                req.body.password = await bcrypt.hashSync(cryptoEncryptedString, process.env.SALT || baseConfig.SALT)
            }
            const payload = this.autoFillTrackingColumns(req, res, modelLoaded)
            const findMentorDetail = await this.crudService.findOne(modelLoaded, { where: where });
            if (!findMentorDetail || findMentorDetail instanceof Error) {
                throw notFound();
            } else {
                const mentorData = await this.crudService.update(modelLoaded, payload, { where: where });
                const userData = await this.crudService.update(user, payload, { where: { user_id: findMentorDetail.dataValues.user_id } });
                if (!mentorData || !userData) {
                    throw badRequest()
                }
                if (mentorData instanceof Error) {
                    throw mentorData;
                }
                if (userData instanceof Error) {
                    throw userData;
                }
                const data = { userData, mentor };
                return res.status(200).send(dispatcher(res, data, 'updated'));
            }
        } catch (error) {
            next(error);
        }
    }
    private async register(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (!req.body.organization_code || req.body.organization_code === "") return res.status(406).send(dispatcher(res, speeches.ORG_CODE_REQUIRED, 'error', speeches.NOT_ACCEPTABLE, 406));
        const org = await this.authService.checkOrgDetails(req.body.organization_code);
        if (!org) {
            return res.status(406).send(dispatcher(res, org, 'error', speeches.ORG_CODE_NOT_EXISTS, 406));
        }
        if (!req.body.role || req.body.role !== 'MENTOR') {
            return res.status(406).send(dispatcher(res, null, 'error', speeches.USER_ROLE_REQUIRED, 406));
        }
        req.body['reg_status'] = '3';
        if (!req.body.password || req.body.password == null) req.body.password = '';
        if (req.body.district) {
            const where: any = {};
            where[`organization_code`] = req.body.organization_code;
            const playload = {
                'district': req.body.district
            }
            const uporg = await this.crudService.update(organization, playload, { where: where })
        }
        const payloadData = this.autoFillTrackingColumns(req, res, mentor);
        const result: any = await this.authService.mentorRegister(payloadData);
        if (result && result.output && result.output.payload && result.output.payload.message == 'Email') {
            return res.status(406).send(dispatcher(res, result.data, 'error', speeches.MENTOR_EXISTS, 406));
        }
        if (result && result.output && result.output.payload && result.output.payload.message == 'Mobile') {
            return res.status(406).send(dispatcher(res, result.data, 'error', speeches.MOBILE_EXISTS, 406));
        }
        // // const otp = await this.authService.generateOtp();
        // let otp = await this.authService.triggerOtpMsg(req.body.mobile); //async function but no need to await ...since we yet do not care about the outcome of the sms trigger ....!!this may need to change later on ...!!
        // otp = String(otp)
        // let hashString = await this.authService.generateCryptEncryption(otp);
        // const updatePassword = await this.authService.crudService.update(user,
        //     { password: await bcrypt.hashSync(hashString, process.env.SALT || baseConfig.SALT) },
        //     { where: { user_id: result.dataValues.user_id } });
        // const findMentorDetailsAndUpdateOTP: any = await this.crudService.updateAndFind(mentor,
        //     { otp: otp },
        //     { where: { user_id: result.dataValues.user_id } }
        // );
        const data = result.dataValues;
        return res.status(201).send(dispatcher(res, data, 'success', speeches.USER_REGISTERED_SUCCESSFULLY, 201));
    }
    private async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        req.body['role'] = 'MENTOR'
        try {
            const result = await this.authService.login(req.body);
            if (!result) {
                return res.status(404).send(dispatcher(res, result, 'error', speeches.USER_NOT_FOUND));
            }
            // else if (result.error) {
            //     return res.status(401).send(dispatcher(res, result.error, 'error', speeches.USER_RISTRICTED, 401));
            // }
            else {
                // mentorDetails = await this.authService.getServiceDetails('mentor', { user_id: result.data.user_id });
                // result.data['mentor_id'] = mentorDetails.dataValues.mentor_id
                const mentorData = await this.authService.crudService.findOne(mentor, {
                    where: { user_id: result.data.user_id },
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
                if(mentorData.dataValues.organization.status !=="ACTIVE"){
                    return res.status(401).send(dispatcher(res, 'organization inactive', 'error', speeches.USER_RISTRICTED, 401))
                }
                result.data['mentor_id'] = mentorData.dataValues.mentor_id;
                result.data['organization_name'] = mentorData.dataValues.organization.organization_name;
                result.data['state'] = mentorData.dataValues.organization.state;
                result.data['title'] = mentorData.dataValues.title;
                result.data['gender'] = mentorData.dataValues.gender;
                return res.status(200).send(dispatcher(res, result.data, 'success', speeches.USER_LOGIN_SUCCESS));
            }
        } catch (error) {
            return res.status(401).send(dispatcher(res, error, 'error', speeches.USER_RISTRICTED, 401));
        }
    }
    private async logout(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        const result = await this.authService.logout(req.body, res);
        if (result.error) {
            next(result.error);
        } else {
            return res.status(200).send(dispatcher(res, speeches.LOGOUT_SUCCESS, 'success'));
        }
    }
    private async changePassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        const result = await this.authService.changePassword(req.body, res);
        if (!result) {
            return res.status(404).send(dispatcher(res, null, 'error', speeches.USER_NOT_FOUND));
        } else if (result.error) {
            return res.status(404).send(dispatcher(res, result.error, 'error', result.error));
        }
        else if (result.match) {
            return res.status(404).send(dispatcher(res, null, 'error', speeches.USER_PASSWORD));
        } else {
            return res.status(202).send(dispatcher(res, result.data, 'accepted', speeches.USER_PASSWORD_CHANGE, 202));
        }
    }
    private async deleteAllData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const mentor_user_id: any = await this.authService.decryptGlobal(req.params.mentor_user_id);
            // const { mobile } = req.body;
            if (!mentor_user_id) {
                throw badRequest(speeches.USER_USERID_REQUIRED);
            }

            //get mentor details
            const mentorResult: any = await this.crudService.findOne(mentor, { where: { user_id: mentor_user_id } })
            if (!mentorResult) {
                throw internal(speeches.DATA_CORRUPTED)
            }
            if (mentorResult instanceof Error) {
                throw mentorResult
            }
            const mentor_id = mentorResult.dataValues.mentor_id
            if (!mentor_id) {
                throw internal(speeches.DATA_CORRUPTED + ":" + speeches.MENTOR_NOT_EXISTS)
            }
            const deleteMentorResponseResult = await this.authService.bulkDeleteMentorResponse(mentor_user_id)
            if (!deleteMentorResponseResult) {
                throw internal("error while deleting mentor response")
            }
            if (deleteMentorResponseResult instanceof Error) {
                throw deleteMentorResponseResult
            }

            //get team details
            const teamResult: any = await team.findAll({
                attributes: ["team_id"],
                where: { mentor_id: mentor_id },
                raw: true
            })
            if (!teamResult) {
                throw internal(speeches.DATA_CORRUPTED)
            }
            if (teamResult instanceof Error) {
                throw teamResult
            }

            const arrayOfteams = teamResult.map((teamSingleresult: any) => {
                return teamSingleresult.team_id;
            })
            if (arrayOfteams && arrayOfteams.length > 0) {
                const studentUserIds = await student.findAll({
                    where: { team_id: arrayOfteams },
                    raw: true,
                    attributes: ["user_id"]
                })

                if (studentUserIds && !(studentUserIds instanceof Error)) {
                    const arrayOfStudentuserIds = studentUserIds.map((student) => student.user_id)

                    for (var i = 0; i < arrayOfStudentuserIds.length; i++) {
                        const deletStudentResponseData = await this.authService.bulkDeleteUserResponse(arrayOfStudentuserIds[i])
                        if (deletStudentResponseData instanceof Error) {
                            throw deletStudentResponseData;
                        }
                    };
                    const resultBulkDeleteStudents = await this.authService.bulkDeleteUserWithStudentDetails(arrayOfStudentuserIds)
                    // console.log("resultBulkDeleteStudents",resultBulkDeleteStudents)
                    // if(!resultBulkDeleteStudents){
                    //     throw internal("error while deleteing students")
                    // }
                    if (resultBulkDeleteStudents instanceof Error) {
                        throw resultBulkDeleteStudents
                    }
                }

                const resultTeamDelete = await this.crudService.delete(team, { where: { team_id: arrayOfteams } })
                // if(!resultTeamDelete){
                //     throw internal("error while deleting team")
                // }
                if (resultTeamDelete instanceof Error) {
                    throw resultTeamDelete
                }
            }
            let resultmentorDelete: any = {};
            resultmentorDelete = await this.authService.bulkDeleteUserWithMentorDetails([mentor_user_id])
            // if(!resultmentorDelete){
            //     throw internal("error while deleting mentor")
            //}
            if (resultmentorDelete instanceof Error) {
                throw resultmentorDelete
            }

            // if (!resultmentorDelete) {
            //     return res.status(404).send(dispatcher(res, null, 'error', speeches.USER_NOT_FOUND));
            // } else 
            if (resultmentorDelete.error) {
                return res.status(404).send(dispatcher(res, resultmentorDelete.error, 'error', resultmentorDelete.error));
            } else {
                return res.status(202).send(dispatcher(res, resultmentorDelete.dataValues, 'success', speeches.USER_DELETED, 202));
            }
        } catch (error) {
            next(error)
        }
    }
    private async emailOtp(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { username } = req.body;
            if (!username) {
                throw badRequest(speeches.USER_EMAIL_REQUIRED);
            }
            const result = await this.authService.emailotp(req.body);
            if (result.error) {
                if (result && result.error.output && result.error.output.payload && result.error.output.payload.message == 'Email') {
                    return res.status(406).send(dispatcher(res, result.data, 'error', speeches.MENTOR_EXISTS, 406));
                } else if (result && result.error.output && result.error.output.payload && result.error.output.payload.message == 'Mobile') {
                    return res.status(406).send(dispatcher(res, result.data, 'error', speeches.MENTOR_EXISTS_MOBILE, 406));
                }
                else {
                    return res.status(404).send(dispatcher(res, result.error, 'error', result.error));
                }
            } else {
                return res.status(202).send(dispatcher(res, result.data, 'accepted', speeches.OTP_SEND_EMAIL, 202));
            }
        } catch (error) {
            next(error)
        }
    }
    private async resetPassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { email, username, otp } = req.body;
            let otpCheck = typeof otp == 'boolean' && otp == false ? otp : true;
            if (otpCheck) {
                if (!email) {
                    throw badRequest(speeches.USER_EMAIL_REQUIRED);
                }
            } else {
                if (!username) {
                    throw badRequest(speeches.USER_EMAIL_REQUIRED);
                }
            }
            const result = await this.authService.mentorResetPassword(req.body);
            if (!result) {
                return res.status(404).send(dispatcher(res, null, 'error', speeches.USER_NOT_FOUND));
            } else if (result.error) {
                return res.status(404).send(dispatcher(res, result.error, 'error', result.error));
            } else {
                return res.status(202).send(dispatcher(res, result.data, 'accepted', speeches.USER_PASS_UPDATE, 202));
            }
        } catch (error) {
            next(error)
        }
    }
    protected async mentorpdfdata(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let data: any = {};
            const { model } = req.params;
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const id = newREQQuery.id;
            const user_id = newREQQuery.user_id;
            const paramStatus: any = newREQQuery.status;
            if (model) {
                this.model = model;
            };

            const modelClass = await this.loadModel(model).catch(error => {
                next(error)
            });
            const where: any = {};
            let whereClauseStatusPart: any = {};
            let boolStatusWhereClauseRequired = false;
            if (paramStatus && (paramStatus in constents.common_status_flags.list)) {
                if (paramStatus === 'ALL') {
                    whereClauseStatusPart = {};
                    boolStatusWhereClauseRequired = false;
                } else {
                    whereClauseStatusPart = { "status": paramStatus };
                    boolStatusWhereClauseRequired = true;
                }
            } else {
                whereClauseStatusPart = { "status": "ACTIVE" };
                boolStatusWhereClauseRequired = true;
            };
            where[`mentor_id`] = id;
            data['mentorData'] = await this.crudService.findOne(modelClass, {
                where: {
                    [Op.and]: [
                        whereClauseStatusPart,
                        where,
                    ]
                },
                attributes: ['mentor_id',
                    "user_id",
                    "full_name",
                    "mobile"],
                include: [

                    {
                        model: organization,
                        attributes: [
                            "organization_code",
                            "organization_name",
                            "state",
                            "district",
                            "category"
                        ]
                    },
                    {
                        model: user,
                        attributes: [
                            "username"
                        ]
                    }

                ],
            });
            const currentProgress = await db.query(`SELECT count(*)as currentValue FROM mentor_topic_progress where user_id = ${user_id}`, { type: QueryTypes.SELECT })
            data['currentProgress'] = Object.values(currentProgress[0]).toString();
            data['totalProgress'] = baseConfig.MENTOR_COURSE
            data['teamsCount'] = await db.query(`SELECT count(*) as teams_count FROM teams where mentor_id = ${id}`, { type: QueryTypes.SELECT });
            data['studentCount'] = await db.query(`SELECT count(*) as student_count FROM students join teams on students.team_id = teams.team_id  where mentor_id = ${id};`, { type: QueryTypes.SELECT });
            data['IdeaCount'] = await db.query(`SELECT count(*) as idea_count FROM challenge_responses join teams on challenge_responses.team_id = teams.team_id where mentor_id = ${id} && challenge_responses.status = 'SUBMITTED';`, { type: QueryTypes.SELECT });
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
    protected async triggerWelcomeEmail(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const result = await this.authService.triggerWelcome(req.body);
            return res.status(200).send(dispatcher(res, result, 'success'));
        } catch (error) {
            next(error);
        }
    }
    private async addBadgeToMentor(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            //todo: test this api : haven't manually tested this api yet 
            const mentor_user_id: any = await this.authService.decryptGlobal(req.params.mentor_user_id);
            const badges_ids: any = req.body.badge_ids;
            const badges_slugs: any = req.body.badge_slugs;
            let areSlugsBeingUsed = true;
            if (!badges_slugs || !badges_slugs.length || badges_slugs.length <= 0) {
                areSlugsBeingUsed = false;
            }

            if (!areSlugsBeingUsed && (!badges_ids || !badges_ids.length || badges_ids.length <= 0)) {
                throw badRequest(speeches.BADGE_IDS_ARRAY_REQUIRED)
            }

            let mentorBadgesObj: any = await this.authService.getMentorBadges(mentor_user_id);
            ///do not do empty or null check since badges obj can be null if no badges earned yet hence this is not an error condition 
            if (mentorBadgesObj instanceof Error) {
                throw mentorBadgesObj
            }
            if (!mentorBadgesObj) {
                mentorBadgesObj = {};
            }
            const errors: any = []

            let forLoopArr = badges_slugs;

            if (!areSlugsBeingUsed) {
                forLoopArr = badges_ids
            }

            for (var i = 0; i < forLoopArr.length; i++) {
                let badgeId = forLoopArr[i];
                let badgeFindWhereClause: any = {
                    slug: badgeId
                }
                if (!areSlugsBeingUsed) {
                    badgeFindWhereClause = {
                        badge_id: badgeId
                    }
                }
                const badgeResultForId = await this.crudService.findOne(badge, { where: badgeFindWhereClause })
                if (!badgeResultForId) {
                    errors.push({ id: badgeId, err: badRequest(speeches.DATA_NOT_FOUND) })
                    continue;
                }
                if (badgeResultForId instanceof Error) {
                    errors.push({ id: badgeId, err: badgeResultForId })
                    continue;
                }

                const mentorHasBadgeObjForId = mentorBadgesObj[badgeResultForId.dataValues.slug]
                if (!mentorHasBadgeObjForId || !mentorHasBadgeObjForId.completed_date) {
                    mentorBadgesObj[badgeResultForId.dataValues.slug] = {
                        completed_date: (new Date())
                    }
                }
            }
            const mentorBadgesObjJson = JSON.stringify(mentorBadgesObj)
            const result: any = await mentor.update({ badges: mentorBadgesObjJson }, {
                where: {
                    user_id: mentor_user_id
                }
            })
            if (result instanceof Error) {
                throw result;
            }

            if (!result) {
                return res.status(404).send(dispatcher(res, null, 'error', speeches.USER_NOT_FOUND));
            }
            let dispatchStatus = "updated"
            let resStatus = 202
            let dispatchStatusMsg = speeches.USER_BADGES_LINKED
            if (errors && errors.length > 0) {
                dispatchStatus = "error"
                dispatchStatusMsg = "error"
                resStatus = 400
            }

            return res.status(resStatus).send(dispatcher(res, { errs: errors, success: mentorBadgesObj }, dispatchStatus, dispatchStatusMsg, resStatus));
        } catch (err) {
            next(err)
        }
    }
    private async getMentorBadges(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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

            const totalnumber = await this.crudService.findAndCountAll(team, {
                where: {
                    mentor_id: newREQQuery.mentor_id
                }
            })
            const mentor_user_id: any = await this.authService.decryptGlobal(req.params.mentor_user_id);

            if (totalnumber.count > 4) {
                await this.authService.addbadgesformentor(mentor_user_id, ['active_mentor'])
            }
            if (totalnumber.count > 9) {
                await this.authService.addbadgesformentor(mentor_user_id, ['inspirational_mentor'])
            }

            let mentorBadgesObj: any = await this.authService.getMentorBadges(mentor_user_id);
            ///do not do empty or null check since badges obj can be null if no badges earned yet hence this is not an error condition 
            if (mentorBadgesObj instanceof Error) {
                throw mentorBadgesObj
            }
            if (!mentorBadgesObj) {
                mentorBadgesObj = {};
            }

            const paramStatus: any = newREQQuery.status;
            const where: any = {};
            let whereClauseStatusPart: any = {};
            if (paramStatus && (paramStatus in constents.common_status_flags.list)) {
                whereClauseStatusPart = { "status": paramStatus }
            }
            if (paramStatus && (paramStatus in constents.common_status_flags.list)) {
                whereClauseStatusPart = { "status": paramStatus }
            }
            where['role'] = 'mentor';
            const allBadgesResult = await badge.findAll({
                where: {
                    [Op.and]: [
                        whereClauseStatusPart,
                        where,
                    ]
                },
                raw: true,
            });

            if (!allBadgesResult) {
                throw notFound(speeches.DATA_NOT_FOUND);
            }
            if (allBadgesResult instanceof Error) {
                throw allBadgesResult;
            }
            for (var i = 0; i < allBadgesResult.length; i++) {
                const currBadge: any = allBadgesResult[i];
                if (mentorBadgesObj.hasOwnProperty("" + currBadge.slug)) {
                    currBadge["mentor_status"] = mentorBadgesObj[("" + currBadge.slug)].completed
                } else {
                    currBadge["mentor_status"] = null;
                }
                allBadgesResult[i] = currBadge
            }

            return res.status(200).send(dispatcher(res, allBadgesResult, 'success'));
        } catch (err) {
            next(err)
        }
    }
    protected async getteamCredentials(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let result: any = {};
            const deValue: any = await this.authService.decryptGlobal(req.params.mentorId);
            if (req.params.mentorId) {
                result = await db.query(`SELECT teams.team_id,team_name,(SELECT username FROM users WHERE user_id = teams.user_id) AS username FROM teams WHERE mentor_id = ${deValue} GROUP BY teams.team_id ORDER BY team_id DESC`, { type: QueryTypes.SELECT });
            }
            return res.status(200).send(dispatcher(res, result, 'success'));
        }
        catch (err) {
            next(err)
        }
    }
};

