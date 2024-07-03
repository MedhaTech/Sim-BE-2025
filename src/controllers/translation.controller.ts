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
        this.router.get(`${this.path}/key`, this.getTrasnlationKey.bind(this));
        this.router.post(`${this.path}/translate-refresh`, this.translationRefresh.bind(this));
        super.initializeRoutes();
    }
    protected async getTrasnlationKey(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN') {
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
            const value: any = newREQQuery.val
            if (!value) {
                throw badRequest();
            }
            const result = TranslationsProvider.getTranslationKeyForValue(res.locals.translationService.getCurrentLocale(), value)

            res.locals.translationService.setCurrentLocale(constents.translations_flags.default_locale)
            res.status(200).send(dispatcher(res, result, "success"))
        } catch (err) {
            next(err)
        }
    }
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

    protected async translationRefresh(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        let translateTable = req.body?.translateTable ? req.body?.translateTable : '*';

        try {
            const service = new TranslationService();
            let ser = await service.translationRefresh(translateTable);

            res.status(201).send(ser);
        } catch (err) {
            console.log("🚀 ~ file: translation.controller.ts ~ line 63 ~ TranslationController ~ err", err)
            next(err)
        }
    }
}