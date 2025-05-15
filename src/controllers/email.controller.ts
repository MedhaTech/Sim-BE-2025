
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import { emailSchema, emailUpdateSchema } from "../validations/email.validations";
import { Request, Response, NextFunction } from 'express';
import dispatcher from "../utils/dispatch.util";
import { speeches } from "../configs/speeches.config";
import db from "../utils/dbconnection.util"
import { QueryTypes } from "sequelize";

export default class EmailController extends BaseController {

    model = "email";

    protected initializePath(): void {
        this.path = '/emails';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(emailSchema, emailUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.get(`${this.path}/listEmailStats`, this.getlistEmailStats.bind(this));
        this.router.get(`${this.path}/emailStats`, this.getEmailStats.bind(this));
        super.initializeRoutes();
    }
    //fetching email data logs
    private async getlistEmailStats(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            const result = await db.query(`SELECT * FROM email_logs;`, { type: QueryTypes.SELECT });
            return res.status(200).send(dispatcher(res, result, 'success'));
        } catch (error) {
            next(error);
        }

    }
    //fetching email send stats
    private async getEmailStats(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const result = await db.query(`SELECT 
    COUNT(CASE
        WHEN status = 'Bounced' THEN 1
    END) AS BouncedCount,
    COUNT(CASE
        WHEN status = 'Delivered' THEN 1
    END) AS DeliveredCount,
    COUNT(CASE
        WHEN status = 'Complaint' THEN 1
    END) AS ComplaintCount
FROM
    email_logs;
`, { type: QueryTypes.SELECT });
            return res.status(200).send(dispatcher(res, result, 'success'));
        } catch (error) {
            next(error);
        }

    }
} 
