import { NextFunction, Request, Response } from "express";
import { speeches } from "../configs/speeches.config";
import dispatcher from "../utils/dispatch.util";
import BaseController from "./base.controller";
import authService from "../services/auth.service";
import { badRequest, notFound } from "boom";
import ValidationsHolder from "../validations/validationHolder";
import { state } from "../models/state.model";
import { state_specificUpdateSchema, stateChangePasswordSchema, stateLoginSchema, stateSchema, stateUpdateSchema } from "../validations/states.validationa";
import validationMiddleware from "../middlewares/validation.middleware";
import { state_specific } from "../models/state_specific.model";
import { user } from "../models/user.model";

export default class StateController extends BaseController {

    model = "state";
    authService: authService = new authService;

    protected initializePath(): void {
        this.path = '/states';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(stateSchema, stateUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.post(`${this.path}/login`, validationMiddleware(stateLoginSchema), this.login.bind(this));
        this.router.get(`${this.path}/logout`, this.logout.bind(this));
        this.router.put(`${this.path}/changePassword`, validationMiddleware(stateChangePasswordSchema), this.changePassword.bind(this));
        this.router.put(`${this.path}/resetPassword`, this.resetPassword.bind(this));
        this.router.get(`${this.path}/specific`, this.getStateSpecific.bind(this));
        this.router.put(`${this.path}/specific/:id`, validationMiddleware(state_specificUpdateSchema), this.updateSpecific.bind(this));
        super.initializeRoutes();
    };
    //creating the state users
    protected async createData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        const payload = this.autoFillTrackingColumns(req, res, state);
        const result = await this.authService.register(payload);
        if (result.user_res) return res.status(406).send(dispatcher(res, result.user_res.dataValues, 'error', speeches.MENTOR_EXISTS, 406));
        return res.status(201).send(dispatcher(res, result.profile.dataValues, 'success', speeches.USER_REGISTERED_SUCCESSFULLY, 201));
    }
    //login api for the state users 
    //Input username and password
    private async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            req.body['role'] = 'STATE';
            const result = await this.authService.login(req.body);
            if (!result) {
                return res.status(404).send(dispatcher(res, result, 'error', speeches.USER_NOT_FOUND));
            }
            else if (result.error) {
                return res.status(401).send(dispatcher(res, result.error, 'error', speeches.USER_RISTRICTED, 401));;
            }
            else {
                const stateData = await this.authService.crudService.findOne(state, {
                    where: { user_id: result.data.user_id }
                });
                result.data['state_name'] = stateData.dataValues.state_name;
                return res.status(200).send(dispatcher(res, result.data, 'success', speeches.USER_LOGIN_SUCCESS));
            }
        } catch (error) {
            return res.status(401).send(dispatcher(res, error, 'error', speeches.USER_RISTRICTED, 401));
        }
    }
    //logout api for the state users
    private async logout(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        const result = await this.authService.logout(req.body, res);
        if (result.error) {
            next(result.error);
        } else {
            return res.status(200).send(dispatcher(res, speeches.LOGOUT_SUCCESS, 'success'));
        }
    }
    //updating the state data by state id
    protected async updateData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { model } = req.params;
            if (model) {
                this.model = model;
            };
            const where: any = {};
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            where[`${this.model}_id`] = newParamId;
            const modelLoaded = await this.loadModel(model);
            const payload = this.autoFillTrackingColumns(req, res, modelLoaded)
            const findAdminDetail = await this.crudService.findOne(modelLoaded, { where: where });
            if (!findAdminDetail || findAdminDetail instanceof Error) {
                throw notFound();
            } else {
                const SSData = await this.crudService.update(modelLoaded, payload, { where: where });
                const userData = await this.crudService.update(user, payload, { where: { user_id: findAdminDetail.dataValues.user_id } });
                if (!SSData || !userData) {
                    throw badRequest()
                }
                if (SSData instanceof Error) {
                    throw SSData;
                }
                if (userData instanceof Error) {
                    throw userData;
                }
                const data = { userData, SSData };
                return res.status(200).send(dispatcher(res, data, 'updated'));
            }
        } catch (error) {
            next(error);
        }
    }
    //change password for state
    private async changePassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STATE') {
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
    //fetching state all details 
    //Single state details by state id
    //all state list
    protected async getData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let data: any = {}
            const where: any = {};
            const { id } = req.params;
            if (id) {
                const newParamId = await this.authService.decryptGlobal(req.params.id);
                where[`state_id`] = newParamId;
                data = await this.crudService.findOne(state, {
                    where: [where],
                    include: {
                        model: user,
                        attributes: [
                            "user_id",
                            "username",
                            "full_name",
                            "role"
                        ]
                    }
                }
                )
            } else {
                data = await this.crudService.findAll(state, {
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
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    }
    //reseting state password to default 
    private async resetPassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { id } = req.body;
            if (!id) {
                throw badRequest(speeches.ID_REQUIRED);
            }
            const result = await this.authService.stateResetPassword(req.body);
            if (result.error) {
                return res.status(404).send(dispatcher(res, result.error, 'error', result.error));
            } else {
                return res.status(202).send(dispatcher(res, result.data, 'accepted', 'The password has been reset', 202));
            }
        } catch (error) {
            next(error)
        }
    }
    //fetching state specific details from state specific table by state name
    private async getStateSpecific(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STATE' && res.locals.role !== 'TEAM') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let data: any = {}
            const where: any = {};
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const { state } = newREQQuery
            const { id } = req.params;
            if (id) {
                const newParamId = await this.authService.decryptGlobal(req.params.id);
                where[`state_specific_id`] = newParamId;
                data = await this.crudService.findOne(state_specific, {
                    where: [where]
                })
            } else if (state) {
                data = await this.crudService.findOne(state_specific, {
                    where: { ['state_name']: state }
                })
            }
            else {
                data = await this.crudService.findAll(state_specific)
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    }
    //updating state specific details in state specific table by state specific id
    private async updateSpecific(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const where: any = {};
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            where[`state_specific_id`] = newParamId;
            req.body['updated_by'] = res.locals.user_id;
            const findSSDetail = await this.crudService.findOne(state_specific, { where: where });
            if (!findSSDetail || findSSDetail instanceof Error) {
                throw notFound();
            } else {
                const SSData = await this.crudService.update(state_specific, req.body, { where: where });

                if (!SSData) {
                    throw badRequest()
                }
                if (SSData instanceof Error) {
                    throw SSData;
                }
                return res.status(200).send(dispatcher(res, SSData, 'updated'));
            }
        } catch (error) {
            next(error);
        }
    }
}
