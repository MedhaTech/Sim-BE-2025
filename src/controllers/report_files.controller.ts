import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import { report_fileSchema, report_fileUpdateSchema } from "../validations/report_files.validations";
import { Request, Response, NextFunction } from 'express';
import dispatcher from "../utils/dispatch.util";
import { unauthorized } from "boom";
import { speeches } from "../configs/speeches.config";
import { report_file } from "../models/report_file.model";

export default class ReportFilesController extends BaseController {

    model = "report_file";

    protected initializePath(): void {
        this.path = '/report_files';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(report_fileSchema, report_fileUpdateSchema);
    }
    protected initializeRoutes(): void {
        super.initializeRoutes();
    }
    protected async getData(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN') {
            throw unauthorized(speeches.ROLE_ACCES_DECLINE)
        }
        let newREQQuery: any = {}
        if (req.query.Data) {
            let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
            newREQQuery = JSON.parse(newQuery);
        } else if (Object.keys(req.query).length !== 0) {
            return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
        }
        try {
            const result = await this.crudService.findAll(report_file, {
                where: {
                    report_type: newREQQuery.report_type
                }
            })
            return res.status(200).send(dispatcher(res, result, 'success'));
        } catch (error) {
            next(error);
        }

    }
} 
