import { NextFunction, Request, Response } from "express";
import { speeches } from "../configs/speeches.config";
import dispatcher from "../utils/dispatch.util";
import BaseController from "./base.controller";
import authService from "../services/auth.service";
import { badRequest } from "boom";
import { state_coordinators } from "../models/state_coordinators.model";

export default class StateController extends BaseController {

    model = "state_coordinators";
    authService: authService = new authService;

    protected initializePath(): void {
        this.path = '/state_coordinators';
    }
    protected initializeValidations(): void {
    }
    protected initializeRoutes(): void {
        this.router.post(`${this.path}/login`, this.login.bind(this));
        this.router.get(`${this.path}/logout`, this.logout.bind(this));
        this.router.put(`${this.path}/changePassword`, this.changePassword.bind(this));
        this.router.put(`${this.path}/resetPassword`, this.resetPassword.bind(this));
        super.initializeRoutes();
    };

    private async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const result = await this.authService.statelogin(req.body);
            if (!result) {
                return res.status(404).send(dispatcher(res, result, 'error', speeches.USER_NOT_FOUND));
            }
            else if (result.error) {
                return res.status(403).send(dispatcher(res, result, 'error'));
            }
            else {
                return res.status(200).send(dispatcher(res, result.data, 'success', speeches.USER_LOGIN_SUCCESS));
            }
        } catch (error) {
            return res.status(401).send(dispatcher(res, error, 'error', speeches.USER_RISTRICTED, 401));
        }
    }
    private async logout(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        const result = await this.authService.statelogout(req.body, res);
        if (result.error) {
            next(result.error);
        } else {
            return res.status(200).send(dispatcher(res, speeches.LOGOUT_SUCCESS, 'success'));
        }
    }
    private async changePassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        const result = await this.authService.statechangePassword(req.body, res);
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
                where[`state_coordinators_id`] = newParamId;
                data = await this.crudService.findOne(state_coordinators, {
                    where: [where]
                })
            }
            else {
                data = await this.crudService.findAll(state_coordinators, {
                    attributes: [
                        "state_coordinators_id",
                        "state_name",
                        "whatapp_link",
                        "ideaSubmission"
                    ]
                })
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    }
}
