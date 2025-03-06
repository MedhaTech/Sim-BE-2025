import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import * as csv from "fast-csv";
import { speeches } from '../configs/speeches.config';
import dispatcher from '../utils/dispatch.util';
import authService from '../services/auth.service';
import BaseController from './base.controller';
import ValidationsHolder from '../validations/validationHolder';
import { evaluatorRegSchema, evaluatorUpdateSchema } from '../validations/evaluator.validationa';
import { evaluator } from '../models/evaluator.model';
import { user } from '../models/user.model';
import { badRequest, notFound, unauthorized } from 'boom';
import db from "../utils/dbconnection.util"
import { evaluation_process } from '../models/evaluation_process.model';
import validationMiddleware from '../middlewares/validation.middleware';
import { baseConfig } from '../configs/base.config';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';

export default class EvaluatorController extends BaseController {
    model = "evaluator";
    authService: authService = new authService;
    private password = process.env.GLOBAL_PASSWORD;

    protected initializePath(): void {
        this.path = '/evaluators';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(evaluatorRegSchema, evaluatorUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.post(`${this.path}/register`, validationMiddleware(evaluatorRegSchema), this.register.bind(this));
        this.router.post(`${this.path}/login`, this.login.bind(this));
        this.router.get(`${this.path}/logout`, this.logout.bind(this));
        this.router.put(`${this.path}/changePassword`, this.changePassword.bind(this));;
        this.router.put(`${this.path}/resetPassword`, this.resetPassword.bind(this));
        super.initializeRoutes();
    };

    protected async getData(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EADMIN' && res.locals.role !== 'EVALUATOR') {
            throw unauthorized(speeches.ROLE_ACCES_DECLINE)
        }
        let data: any;
        const { model, id } = req.params;
        if (model) {
            this.model = model;
        };
        const modelClass = await this.loadModel(model).catch(error => {
            next(error)
        });
        const where: any = {};
        if (id) {
            const deValue: any = await this.authService.decryptGlobal(req.params.id);
            where[`${this.model}_id`] = JSON.parse(deValue);
            data = await this.crudService.findOne(modelClass, {
                attributes: [
                    "evaluator_id", "state", "mobile", "status","language","theme",
                ],
                where: {
                    [Op.and]: [
                        where
                    ]
                },
                include: {
                    model: user,
                    attributes: [
                        "user_id",
                        "username",
                        "full_name"
                    ]
                }
            })
        } else {
            data = await this.crudService.findAll(modelClass, {
                attributes: [
                    "evaluator_id", "state", "mobile", "status","language","theme",
                ],
                include: {
                    model: user,
                    attributes: [
                        "user_id",
                        "username",
                        "full_name"
                    ]
                }
            })
        }
        if (!data || data instanceof Error) {
            if (data != null) {
                throw notFound(data.message)
            } else {
                throw notFound()
            }
        }
        return res.status(200).send(dispatcher(res, data, 'success'));
    }

    protected async updateData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EADMIN' && res.locals.role !== 'EVALUATOR') {
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
            const findEvaluatorDetail = await this.crudService.findOne(modelLoaded, { where: where });
            if (!findEvaluatorDetail || findEvaluatorDetail instanceof Error) {
                throw notFound();
            } else {
                if (req.body.mobile) {
                    const cryptoEncryptedString = await this.authService.generateCryptEncryption(req.body.mobile);
                    payload['password'] = await bcrypt.hashSync(cryptoEncryptedString, process.env.SALT || baseConfig.SALT)
                }
                const evaluatorData = await this.crudService.update(modelLoaded, payload, { where: where });
                const userData = await this.crudService.update(user, payload, { where: { user_id: findEvaluatorDetail.dataValues.user_id } });
                if (!evaluatorData || !userData) {
                    throw badRequest()
                }
                if (evaluatorData instanceof Error) {
                    throw evaluatorData;
                }
                if (userData instanceof Error) {
                    throw userData;
                }
                const data = { userData, evaluator };
                return res.status(200).send(dispatcher(res, data, 'updated'));
            }
        } catch (error) {
            next(error);
        }
    }

    private async register(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (!req.body.username || req.body.username === "") req.body.username = req.body.full_name.replace(/\s/g, '');
        if (!req.body.password || req.body.password === "") req.body.password = this.password;
        if (!req.body.role || req.body.role !== 'EVALUATOR') {
            return res.status(406).send(dispatcher(res, null, 'error', speeches.USER_ROLE_REQUIRED, 406));
        };

        const payload = this.autoFillTrackingColumns(req, res, evaluator);
        payload['state'] = "Andaman and Nicobar Islands,Andhra Pradesh,Arunachal Pradesh,Assam,Bihar,Chandigarh,Chhattisgarh,Dadra and Nagar Haveli and Daman and Diu,Delhi,Goa,Gujarat,Haryana,Himachal Pradesh,Jammu and Kashmir,Jharkhand,Karnataka,Kerala,Ladakh,Lakshadweep,Madhya Pradesh,Maharashtra,Manipur,Meghalaya,Mizoram,Nagaland,Odisha,Puducherry,Punjab,Rajasthan,Sikkim,Tamil Nadu,Telangana,Tripura,Uttar Pradesh,Uttarakhand,West Bengal"
        const result = await this.authService.register(payload);
        if (result.user_res) return res.status(406).send(dispatcher(res, result.user_res.dataValues, 'error', speeches.EVALUATOR_EXISTS, 406));
        return res.status(201).send(dispatcher(res, result.profile.dataValues, 'success', speeches.USER_REGISTERED_SUCCESSFULLY, 201));
    }

    private async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        req.body['role'] = 'EVALUATOR'
        const result = await this.authService.login(req.body);
        if (!result) {
            return res.status(404).send(dispatcher(res, result, 'error', speeches.USER_NOT_FOUND));
        } else if (result.error) {
            return res.status(401).send(dispatcher(res, result.error, 'error', speeches.USER_RISTRICTED, 401));
        } else {
            const evalutorDetails = await this.crudService.findOne(evaluator, { where: { user_id: result.data.user_id } });
            if (!evalutorDetails || evalutorDetails instanceof Error) {
                return res.status(404).send(dispatcher(res, null, 'error', speeches.USER_REG_STATUS));
            }
            result.data['evaluator_id'] = evalutorDetails.dataValues.evaluator_id;
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

    private async changePassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EVALUATOR') {
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

    private async resetPassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { mobile, username } = req.body;
            if (!mobile) {
                throw badRequest(speeches.MOBILE_NUMBER_REQUIRED);
            }
            if (!username) {
                throw badRequest(speeches.USER_EMAIL_REQUIRED);
            }
            const result = await this.authService.evaluatorResetPassword(req.body);
            if (result.error) {
                return res.status(404).send(dispatcher(res, result.error, 'error', result.error));
            } else {
                return res.status(202).send(dispatcher(res, result.data, 'accepted', 'The password has been reset', 202));
            }
        } catch (error) {
            next(error)
        }
    }
};