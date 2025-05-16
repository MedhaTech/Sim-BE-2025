import { badRequest } from "boom";
import { Request, Response, NextFunction } from "express";
import { constents } from "../configs/constents.config";
import TranslationService from "../services/translation.service";
import dispatcher from "../utils/dispatch.util";
import TranslationsProvider from "../utils/translations/translationProvider";
import { translationSchema, translationUpdateSchema } from "../validations/translation.validations";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import { speeches } from "../configs/speeches.config";

export default class TranslationController extends BaseController {

    model = "translation";

    protected initializePath(): void {
        this.path = '/translations';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(translationSchema, translationUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.get(`${this.path}/refresh`, this.refreshTranslation.bind(this));
        super.initializeRoutes();
    }
    //refreshing the translation table 
    protected async refreshTranslation(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const service = new TranslationService();
            await service.refreshDataFromDb();
            res.status(201).send(dispatcher(res, "data refrehsed succesfully", 'success'));
        } catch (err) {
            next(err)
        }
    }
}