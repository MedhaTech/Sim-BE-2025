import { Request, Response, NextFunction } from 'express';
import { customAlphabet } from 'nanoid';
import { speeches } from '../configs/speeches.config';
import dispatcher from '../utils/dispatch.util';
import { studentSchema, studentUpdateSchema } from '../validations/student.validationa';
import bcrypt from 'bcrypt';
import authService from '../services/auth.service';
import BaseController from './base.controller';
import ValidationsHolder from '../validations/validationHolder';
import validationMiddleware from '../middlewares/validation.middleware';
import { constents } from '../configs/constents.config';
import { Op, QueryTypes } from 'sequelize';
import { user } from '../models/user.model';
import { team } from '../models/team.model';
import { baseConfig } from '../configs/base.config';
import { student } from '../models/student.model';
import StudentService from '../services/students.service';
import { badge } from '../models/badge.model';
import { mentor } from '../models/mentor.model';
import { organization } from '../models/organization.model';
import { badRequest, internal, notFound } from 'boom';
import db from "../utils/dbconnection.util"

export default class StudentController extends BaseController {
    model = "student";
    authService: authService = new authService;
    private password = process.env.GLOBAL_PASSWORD;
    private nanoid = customAlphabet('0123456789', 6);

    protected initializePath(): void {
        this.path = '/students';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(studentSchema, studentUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.post(`${this.path}/addStudent`, validationMiddleware(studentSchema), this.register.bind(this));
        this.router.post(`${this.path}/bulkCreateStudent`, this.bulkCreateStudent.bind(this));
        this.router.get(`${this.path}/:student_user_id/studentCertificate`, this.studentCertificate.bind(this));
        this.router.post(`${this.path}/:student_user_id/badges`, this.addBadgeToStudent.bind(this));
        this.router.get(`${this.path}/:student_user_id/badges`, this.getStudentBadges.bind(this));
        //this.router.post(`${this.path}/stuIdeaSubmissionEmail`, this.stuIdeaSubmissionEmail.bind(this));
        this.router.get(`${this.path}/studentsList/:teamId`, this.getStudentsList.bind(this));
        super.initializeRoutes();
    }
    protected async getData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            let data: any;
            const { model, id } = req.params;
            const paramStatus: any = newREQQuery.status;
            if (model) {
                this.model = model;
            };
            // pagination
            const { page, size, adult } = newREQQuery;
            let condition = adult ? { UUID: null } : { UUID: { [Op.like]: `%%` } };
            const { limit, offset } = this.getPagination(page, size);
            const modelClass = await this.loadModel(model).catch(error => {
                next(error)
            });
            const where: any = {};
            let whereClauseStatusPart: any = {}
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
            let state: any = newREQQuery.state;
            let stateFilter: any = {}
            if (state) {
                stateFilter['whereClause'] = state && typeof state == 'string' && state !== 'All States' ? { state } : {}
                stateFilter["liter"] = state && typeof state == 'string' && state !== 'All States' ? db.literal('`team->mentor->organization`.`state` = ' + JSON.stringify(state)) : {}
            }
            if (id) {
                const newParamId = await this.authService.decryptGlobal(req.params.id);
                where[`${this.model}_id`] = newParamId;
                data = await this.crudService.findOne(modelClass, {
                    attributes: {
                        include: [
                            [
                                db.literal(`( SELECT username FROM users AS u WHERE u.user_id = \`student\`.\`user_id\`)`), 'username_email'
                            ]
                        ]
                    },
                    where: {
                        [Op.and]: [
                            whereClauseStatusPart,
                            where,
                        ],
                    },
                    include: {
                        model: team,
                        attributes: [
                            'team_id',
                            'team_name',
                            'mentor_id',
                            'team_email'
                        ],
                        include: {
                            model: mentor,
                            attributes: [
                                'organization_code',
                                'full_name',
                                'gender',
                                'mobile',
                            ],
                            include: {
                                model: organization,
                                attributes: [
                                    "organization_name",
                                    'organization_code',
                                    "unique_code",
                                    "pin_code",
                                    "category",
                                    "principal_name",
                                    "principal_mobile",
                                    "city",
                                    "district",
                                    "state",
                                    "country",
                                    'address'
                                ],
                            },

                        },
                    },
                });
            } else {
                try {
                    const responseOfFindAndCountAll = await this.crudService.findAndCountAll(modelClass, {
                        attributes: {
                            include: [
                                [
                                    db.literal(`( SELECT username FROM users AS u WHERE u.user_id = \`student\`.\`user_id\`)`), 'username_email'
                                ]
                            ]
                        },
                        where: {
                            [Op.and]: [
                                whereClauseStatusPart,
                                // condition,
                                stateFilter.liter
                            ]
                        },
                        include: {
                            model: team,
                            attributes: [
                                'team_id',
                                'team_name',
                                'team_email'
                            ],
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
                            ]
                        }, limit, offset
                    });
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
            const newParamId: any = await this.authService.decryptGlobal(req.params.id);
            const studentTableDetails = await student.findOne(
                {
                    where: {
                        student_id: JSON.parse(newParamId)
                    }
                }
            )
            if (!studentTableDetails) {
                throw notFound(speeches.USER_NOT_FOUND)
            }
            if (studentTableDetails instanceof Error) {
                throw studentTableDetails
            }

            const where: any = {};
            where[`${this.model}_id`] = JSON.parse(newParamId);
            const modelLoaded = await this.loadModel(model);
            const payload = this.autoFillTrackingColumns(req, res, modelLoaded);
            // if (req.body.username) {
            //     const cryptoEncryptedString = await this.authService.generateCryptEncryption('STUDENT@123');
            //     const username = req.body.username;
            //     const studentDetails = await this.crudService.findOne(user, { where: { username: username } });
            //     if (studentDetails) {
            //         if (studentDetails.dataValues.username == username) throw badRequest(speeches.USER_EMAIL_EXISTED);
            //         if (studentDetails instanceof Error) throw studentDetails;
            //     };
            //     const user_data = await this.crudService.update(user, {
            //         full_name: payload.full_name,
            //         username: username,
            //         password: await bcrypt.hashSync(cryptoEncryptedString, process.env.SALT || baseConfig.SALT),
            //     }, { where: { user_id: studentTableDetails.getDataValue("user_id") } });
            //     if (!user_data) {
            //         throw internal()
            //     }
            //     if (user_data instanceof Error) {
            //         throw user_data;
            //     }
            // }
            if (req.body.full_name) {
                const username = `${req.body.team_id}_${req.body.full_name.trim()}`
                const studentDetails = await this.crudService.findOne(user, { where: { username: username } });
                if (studentDetails) {
                    if (studentDetails.dataValues.username == username) throw badRequest("Same named student already exists in this team");
                    if (studentDetails instanceof Error) throw studentDetails;
                };
                const user_data = await this.crudService.update(user, {
                    full_name: payload.full_name,
                    username: username,
                }, { where: { user_id: studentTableDetails.getDataValue("user_id") } });
                if (!user_data) {
                    throw internal()
                }
                if (user_data instanceof Error) {
                    throw user_data;
                }
            }
            const student_data = await this.crudService.updateAndFind(modelLoaded, payload, { where: where });
            if (!student_data) {
                throw badRequest()
            }
            if (student_data instanceof Error) {
                throw student_data;
            }

            return res.status(200).send(dispatcher(res, student_data, 'updated'));
        } catch (error) {
            next(error);
        }
    }
    protected async deleteData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { model, id } = req.params;
            if (model) this.model = model;
            const where: any = {};
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            where[`${this.model}_id`] = newParamId;
            const getUserIdFromStudentData = await this.crudService.findOne(student, { where: { student_id: where.student_id } });
            if (!getUserIdFromStudentData) throw notFound(speeches.USER_NOT_FOUND);
            if (getUserIdFromStudentData instanceof Error) throw getUserIdFromStudentData;
            const user_id = getUserIdFromStudentData.dataValues.user_id;
            const deleteUserStudentAndRemoveAllResponses = await this.authService.deleteStudentAndStudentResponse(user_id);
            const data = deleteUserStudentAndRemoveAllResponses
            return res.status(200).send(dispatcher(res, data, 'deleted'));
        } catch (error) {
            next(error);
        }
    }
    private async register(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            // const randomGeneratedSixDigitID = this.nanoid();
            const { team_id, state } = req.body;
            const cryptoEncryptedString = await this.authService.generateCryptEncryption('STUDENT@123');
            req.body.username = `${req.body.team_id}_${req.body.full_name.trim()}`
            if (!req.body.role || req.body.role !== 'STUDENT') return res.status(406).send(dispatcher(res, null, 'error', speeches.USER_ROLE_REQUIRED, 406));
            if (!req.body.team_id) return res.status(406).send(dispatcher(res, null, 'error', speeches.USER_TEAMID_REQUIRED, 406));

            if (team_id) {
                const teamCanAddMember = await this.authService.checkIfTeamHasPlaceForNewMember(team_id, state)
                if (!teamCanAddMember) {
                    throw badRequest(speeches.TEAM_MAX_MEMBES_EXCEEDED)
                }
                if (teamCanAddMember instanceof Error) {
                    throw teamCanAddMember;
                }
            }
            const teamDetails = await this.authService.crudService.findOne(team, { where: { team_id } });
            if (!teamDetails) return res.status(406).send(dispatcher(res, null, 'error', speeches.TEAM_NOT_FOUND, 406));

            if (!req.body.password || req.body.password === "") req.body.password = cryptoEncryptedString;
            const payload = this.autoFillTrackingColumns(req, res, student)
            const result = await this.authService.register(payload);
            if (result.user_res) return res.status(406).send(dispatcher(res, result.user_res.dataValues, 'error', speeches.STUDENT_EXISTS, 406));
            return res.status(201).send(dispatcher(res, result.profile.dataValues, 'success', speeches.USER_REGISTERED_SUCCESSFULLY, 201));
        } catch (err) {
            next(err)
        }
    }
    private async bulkCreateStudent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            for (let student in req.body) {
                if (!req.body[student].team_id) throw notFound(speeches.USER_TEAMID_REQUIRED);
                const team_id = req.body[student].team_id
                const state = req.body[student].state
                if (team_id) {
                    const teamCanAddMember = await this.authService.checkIfTeamHasPlaceForNewMember(team_id, state)
                    if (!teamCanAddMember) {
                        throw badRequest(speeches.TEAM_MAX_MEMBES_EXCEEDED)
                    }
                    if (teamCanAddMember instanceof Error) {
                        throw teamCanAddMember;
                    }
                }
            }
            let cryptoEncryptedString: any;
            const teamName = await this.authService.crudService.findOne(team, {
                attributes: ["team_name"], where: { team_id: req.body[0].team_id }
            });
            if (!teamName) throw notFound(speeches.TEAM_NOT_FOUND, 406);
            if (teamName instanceof Error) throw teamName;
            for (let student in req.body) {
                cryptoEncryptedString = await this.authService.generateCryptEncryption('STUDENT@123');
                req.body[student].username = `${req.body[student].team_id}_${req.body[student].full_name.trim()}`;
                req.body[student].full_name = req.body[student].full_name.trim();
                req.body[student].role = 'STUDENT';
                req.body[student].password = cryptoEncryptedString;
                req.body[student].created_by = res.locals.user_id
                req.body[student].updated_by = res.locals.user_id
            }
            const responseFromService = await this.authService.bulkCreateStudentService(req.body);
            return res.status(201).send(dispatcher(res, responseFromService, 'success', speeches.USER_REGISTERED_SUCCESSFULLY, 201));
        } catch (error) {
            next(error);
        }
    }
    private async addBadgeToStudent(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            //todo: test this api : haven't manually tested this api yet 
            const student_user_id: any = await this.authService.decryptGlobal(req.params.student_user_id);
            const badges_ids: any = req.body.badge_ids;
            const badges_slugs: any = req.body.badge_slugs;
            let areSlugsBeingUsed = true;
            if (!badges_slugs || !badges_slugs.length || badges_slugs.length <= 0) {
                areSlugsBeingUsed = false;
            }

            if (!areSlugsBeingUsed && (!badges_ids || !badges_ids.length || badges_ids.length <= 0)) {
                throw badRequest(speeches.BADGE_IDS_ARRAY_REQUIRED)
            }

            const serviceStudent = new StudentService()
            let studentBadgesObj: any = await serviceStudent.getStudentBadges(student_user_id);
            ///do not do empty or null check since badges obj can be null if no badges earned yet hence this is not an error condition 
            if (studentBadgesObj instanceof Error) {
                throw studentBadgesObj
            }
            if (!studentBadgesObj) {
                studentBadgesObj = {};
            }
            const success: any = []
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

                const date = new Date();
                const studentHasBadgeObjForId = studentBadgesObj[badgeResultForId.dataValues.slug]
                if (!studentHasBadgeObjForId || !studentHasBadgeObjForId.completed_date) {
                    studentBadgesObj[badgeResultForId.dataValues.slug] = {
                        completed_date: (new Date())
                        // completed_date: ("" + date.getFullYear() + "-" + "" + (date.getMonth() + 1) + "-" + "" + date.getDay())
                    }
                }
            }
            const studentBadgesObjJson = JSON.stringify(studentBadgesObj)
            const result: any = await student.update({ badges: studentBadgesObjJson }, {
                where: {
                    user_id: student_user_id
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

            return res.status(resStatus).send(dispatcher(res, { errs: errors, success: studentBadgesObj }, dispatchStatus, dispatchStatusMsg, resStatus));
        } catch (err) {
            next(err)
        }
    }
    private async getStudentBadges(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        //todo: implement this api ...!!
        try {
            const student_user_id: any = await this.authService.decryptGlobal(req.params.student_user_id);
            const serviceStudent = new StudentService()
            let studentBadgesObj: any = await serviceStudent.getStudentBadges(student_user_id);
            ///do not do empty or null check since badges obj can be null if no badges earned yet hence this is not an error condition 
            if (studentBadgesObj instanceof Error) {
                throw studentBadgesObj
            }
            if (!studentBadgesObj) {
                studentBadgesObj = {};
            }
            const studentBadgesObjKeysArr = Object.keys(studentBadgesObj)
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
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
            where['role'] = 'student';
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
            // console.log(studentBadgesObj);
            for (var i = 0; i < allBadgesResult.length; i++) {
                const currBadge: any = allBadgesResult[i];
                if (studentBadgesObj.hasOwnProperty("" + currBadge.slug)) {
                    currBadge["student_status"] = studentBadgesObj[("" + currBadge.slug)].completed_date
                } else {
                    currBadge["student_status"] = null;
                }
                allBadgesResult[i] = currBadge
            }

            return res.status(200).send(dispatcher(res, allBadgesResult, 'success'));
        } catch (err) {
            next(err)
        }
    }
    private async studentCertificate(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let newREParams: any = {};
            if (req.params) {
                const newParams: any = await this.authService.decryptGlobal(req.params);
                newREParams = JSON.parse(newParams);
            } else {
                newREParams = req.params
            }
            const { model, student_user_id } = newREParams;
            const user_id = res.locals.user_id
            if (model) {
                this.model = model;
            };
            const where: any = {};
            where[`${this.model}_id`] = newREParams.id;
            const modelLoaded = await this.loadModel(model);
            const payload = this.autoFillTrackingColumns(req, res, modelLoaded);
            payload["certificate"] = new Date().toLocaleString();
            const updateCertificate = await this.crudService.updateAndFind(student, payload, {
                where: { student_id: student_user_id }
            });
            if (!updateCertificate) {
                throw internal()
            }
            if (updateCertificate instanceof Error) {
                throw updateCertificate;
            }
            return res.status(200).send(dispatcher(res, updateCertificate, 'Certificate Updated'));
        } catch (error) {
            next(error);
        }
    }
    private async stuIdeaSubmissionEmail(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { mentor_id, team_id, team_name, title } = req.body;
            let data: any = {}
            const contentText = `
            <body style="border: solid;margin-right: 15%;margin-left: 15%; ">
        <img src="https://aim-email-images.s3.ap-south-1.amazonaws.com/Email1SIM_2024.png.jpg" alt="header" style="width: 100%;" />
        <div style="padding: 1% 5%;">
        <h3> Dear ${team_name} team,</h3>

            <p>Your project has been successfully submitted in ATL Marathon 23-24.</p>
            
            <p>Project Titled: ${title}</p>
            <p>We have received your project and it is currently in our review process. Our team will assess your work, and we will notify you of the evaluation results.</p>
            
            <p>We appreciate your hard work and dedication to this project, and we look forward to providing you with feedback and results as soon as possible.</p>
            <p>Thank you for participating In ATL Marathon.</p>
            <p>
            <strong>
            Regards,<br>
            ATL Marathon</strong></p></div></body>`;
            const subject = `ATL marathon - Idea submission successful`
            const summary = await db.query(`SELECT GROUP_CONCAT(username SEPARATOR ', ') AS all_usernames
            FROM (
                    SELECT 
                    u.username
                FROM
                    mentors AS m
                        JOIN
                    users AS u ON m.user_id = u.user_id
                WHERE
                    m.mentor_id = ${mentor_id}
                UNION ALL
                    SELECT 
                    u.username
                FROM
                    students AS s
                        JOIN
                    users AS u ON s.user_id = u.user_id
                WHERE
                    s.team_id = ${team_id}
            ) AS combined_usernames;`, { type: QueryTypes.SELECT });
            data = summary;
            const usernameArray = data[0].all_usernames;
            let arrayOfUsernames = usernameArray.split(', ');
            const result = await this.authService.triggerBulkEmail(arrayOfUsernames, contentText, subject);

            return res.status(200).send(dispatcher(res, result, 'Email sent'));
        } catch (error) {
            next(error);
        }
    }
    protected async getStudentsList(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE' && res.locals.role !== 'TEAM') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let data: any;
            const where: any = {};
            const { teamId } = req.params;
            console.log(teamId);
            if (teamId) {
                const newParamId = await this.authService.decryptGlobal(req.params.teamId);
                console.log(newParamId);
                where[`team_id`] = newParamId;
                data = await this.crudService.findAll(student, {
                    attributes: {
                        include: [
                            [
                                db.literal(`( SELECT role FROM users AS u WHERE u.user_id = \`student\`.\`user_id\`)`), 'role'
                            ],

                        ]
                    },
                    where: {
                        [Op.and]: [
                            where
                        ],
                    },
                    // include: {
                    //     model: team,
                    //     attributes: [
                    //         'team_id',
                    //         'team_name',
                    //     ],
                    //     include: {
                    //         model: mentor,
                    //         attributes: [
                    //             'organization_code',
                    //             'full_name',
                    //             'gender',
                    //             'mobile',
                    //         ],
                    //         include: {
                    //             model: organization,
                    //             attributes: [
                    //                 "organization_name",
                    //                 'organization_code',
                    //                 "unique_code",
                    //                 "pin_code",
                    //                 "category",
                    //                 "principal_name",
                    //                 "principal_mobile",
                    //                 "city",
                    //                 "district",
                    //                 "state",
                    //                 "country",
                    //                 'address'
                    //             ],
                    //         },

                    //     },
                    // },
                });
            }
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
}
