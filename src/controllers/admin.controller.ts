import { Request, Response, NextFunction } from 'express';
import { speeches } from '../configs/speeches.config';
import dispatcher from '../utils/dispatch.util';
import authService from '../services/auth.service';
import BaseController from './base.controller';
import ValidationsHolder from '../validations/validationHolder';
import { user } from '../models/user.model';
import { admin } from '../models/admin.model';
import { adminbulkemail, adminSchema, adminUpdateSchema } from '../validations/admins.validationa';
import { badRequest, notFound, unauthorized } from 'boom';
import { QueryTypes } from 'sequelize';
import db from "../utils/dbconnection.util"
import validationMiddleware from '../middlewares/validation.middleware';
import { email } from '../models/email.model';

export default class AdminController extends BaseController {
    model = "admin";
    authService: authService = new authService;
    private password = process.env.GLOBAL_PASSWORD;

    protected initializePath(): void {
        this.path = '/admins';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(adminSchema, adminUpdateSchema);
    }
    protected initializeRoutes(): void {

        this.router.post(`${this.path}/login`, this.login.bind(this));
        this.router.get(`${this.path}/logout`, this.logout.bind(this));
        this.router.put(`${this.path}/changePassword`, this.changePassword.bind(this));
        this.router.get(`${this.path}/knowqueryparm`, this.getknowqueryparm.bind(this));
        this.router.post(`${this.path}/createqueryparm`, this.getcreatequeryparm.bind(this));
        this.router.post(`${this.path}/bulkEmail`, validationMiddleware(adminbulkemail), this.bulkEmail.bind(this));
        super.initializeRoutes();
    }
    protected async createData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (!req.body.username || req.body.username === "") req.body.username = req.body.full_name.replace(/\s/g, '');
        if (!req.body.password || req.body.password === "") req.body.password = await this.authService.generateCryptEncryption(req.body.username);
        if (req.body.role == 'ADMIN' || req.body.role == 'EADMIN') {
            const payload = this.autoFillTrackingColumns(req, res, admin);
            const result = await this.authService.register(payload);
            if (result.user_res) return res.status(406).send(dispatcher(res, result.user_res.dataValues, 'error', speeches.ADMIN_EXISTS, 406));
            return res.status(201).send(dispatcher(res, result.profile.dataValues, 'success', speeches.USER_REGISTERED_SUCCESSFULLY, 201));
        }
        return res.status(406).send(dispatcher(res, null, 'error', speeches.USER_ROLE_REQUIRED, 406));
    }
    protected async getData(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EADMIN') {
            throw unauthorized(speeches.ROLE_ACCES_DECLINE)
        }
        try {
            const result = await this.crudService.findAll(admin, {
                attributes: [
                    "admin_id",
                    "status"
                ],
                include: {
                    model: user,
                    attributes: [
                        "user_id",
                        "username",
                        "full_name",
                        "role"
                    ]
                }
            })
            return res.status(200).send(dispatcher(res, result, 'success'));
        } catch (error) {
            next(error);
        }

    }

    protected async updateData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN') {
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
            const payload = this.autoFillTrackingColumns(req, res, modelLoaded)
            const findAdminDetail = await this.crudService.findOne(modelLoaded, { where: where });
            if (!findAdminDetail || findAdminDetail instanceof Error) {
                throw notFound();
            } else {
                const adminData = await this.crudService.update(modelLoaded, payload, { where: where });
                const userData = await this.crudService.update(user, payload, { where: { user_id: findAdminDetail.dataValues.user_id } });
                if (!adminData || !userData) {
                    throw badRequest()
                }
                if (adminData instanceof Error) {
                    throw adminData;
                }
                if (userData instanceof Error) {
                    throw userData;
                }
                const data = { userData, admin };
                return res.status(200).send(dispatcher(res, data, 'updated'));
            }
        } catch (error) {
            next(error);
        }
    }

    private async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        let adminDetails: any;
        let newREQQuery: any = {}
        if (req.query.Data) {
            let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
            newREQQuery = JSON.parse(newQuery);
        } else if (Object.keys(req.query).length !== 0) {
            return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
        }
        if (newREQQuery.eAdmin && newREQQuery.eAdmin == 'true') { req.body['role'] = 'EADMIN' } else if (newREQQuery.report && newREQQuery.report == 'true') { req.body['role'] = 'REPORT' } else { req.body['role'] = 'ADMIN' }
        const result = await this.authService.login(req.body);
        if (!result) {
            return res.status(404).send(dispatcher(res, result, 'error', speeches.USER_NOT_FOUND));
        } else if (result.error) {
            return res.status(401).send(dispatcher(res, result.error, 'error', speeches.USER_RISTRICTED, 401));
        } else {
            adminDetails = await this.authService.getServiceDetails('admin', { user_id: result.data.user_id });
            if (!adminDetails) {
                result.data['admin_id'] = null;
            } else {
                result.data['admin_id'] = adminDetails.dataValues.admin_id;
            }
            return res.status(200).send(dispatcher(res, result.data, 'success', speeches.USER_LOGIN_SUCCESS));
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
    private async getknowqueryparm(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN') {
            throw unauthorized(speeches.ROLE_ACCES_DECLINE)
        }
        try {
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            return res.status(200).send(dispatcher(res, newREQQuery, 'success'));
        } catch (error) {
            next(error);
        }

    }
    private async getcreatequeryparm(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN') {
            throw unauthorized(speeches.ROLE_ACCES_DECLINE)
        }
        try {
            let newREQQuery: any = {}
            if (req.query.value) {
                newREQQuery['value'] = await this.authService.encryptGlobal(req.query.value);
            }
            if (req.body) {
                newREQQuery['body'] = await this.authService.encryptGlobal(JSON.stringify(req.body));
            }
            return res.status(200).send(dispatcher(res, newREQQuery, 'success'));
        } catch (error) {
            console.log(error)
            next(error);
        }

    }

    private async changePassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EADMIN') {
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
    private async bulkEmail(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { msg, subject, state } = req.body;
            const payload = this.autoFillTrackingColumns(req, res, email);
            await this.crudService.create(email, payload);
            let data: any = {}
            let stateFilter: any = `'%%'`
            if (state !== 'All States' && state !== undefined) {
                stateFilter = `'${state}'`
            }
            const summary = await db.query(`SELECT 
    GROUP_CONCAT(username
        SEPARATOR ', ') AS all_usernames
FROM
    (SELECT DISTINCT
        u.username
    FROM
        mentors AS m
    JOIN users AS u ON m.user_id = u.user_id
    JOIN organizations AS o ON m.organization_code = o.organization_code
    WHERE
        state LIKE ${stateFilter} AS combined_usernames;`, { type: QueryTypes.SELECT });
            data = summary;
            const usernameArray = data[0].all_usernames;
            let arrayOfUsernames = usernameArray.split(', ');
            const result = await this.authService.triggerBulkEmail(arrayOfUsernames, msg, subject);
            return res.status(200).send(dispatcher(res, result, 'Email sent'));
        } catch (error) {
            next(error);
        }
    }
};