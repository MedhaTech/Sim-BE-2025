import { popupSchema, popupUpdateSchema } from "../validations/popup.validation";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import { S3 } from "aws-sdk";
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import dispatcher from "../utils/dispatch.util";
import { speeches } from "../configs/speeches.config";
import { unauthorized } from "boom";
import { popup } from "../models/popup.model";

export default class popupController extends BaseController {

    model = "popup";

    protected initializePath(): void {
        this.path = '/popup';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(popupSchema, popupUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.post(`${this.path}/popupFileUpload`, this.handleAttachment.bind(this));
        super.initializeRoutes();
    }
    protected async handleAttachment(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }

        try {
            const rawfiles: any = req.files;
            const files: any = Object.values(rawfiles);
            const allowedTypes = ['image/jpeg', 'image/png'];
            if (!allowedTypes.includes(files[0].type)) {
                return res.status(400).send(dispatcher(res, '', 'error', 'This file type not allowed', 400));
            }
            const errs: any = [];
            let attachments: any = [];
            let result: any = {};
            let s3 = new S3({
                apiVersion: '2006-03-01',
                region: process.env.AWS_REGION,
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            });
            if (!req.files) {
                return result;
            }
            let file_name_prefix: any;
            if (process.env.DB_HOST?.includes("prod")) {
                file_name_prefix = `Popup`
            } else if (process.env.DB_HOST?.includes("dev")) {
                file_name_prefix = `Popup/dev`
            }
            else {
                file_name_prefix = `Popup/stage`
            }
            for (const file_name of Object.keys(files)) {
                const file = files[file_name];
                const readFile: any = await fs.readFileSync(file.path);
                if (readFile instanceof Error) {
                    errs.push(`Error uploading file: ${file.originalFilename} err: ${readFile}`)
                }
                file.originalFilename = `${file_name_prefix}/${file.originalFilename}`;
                let params = {
                    Bucket: `${process.env.BUCKET}`,
                    Key: file.originalFilename,
                    Body: readFile
                };
                let options: any = { partSize: 20 * 1024 * 1024, queueSize: 2 };
                await s3.upload(params, options).promise()
                    .then((data: any) => { attachments.push(data.Location) })
                    .catch((err: any) => { errs.push(`Error uploading file: ${file.originalFilename}, err: ${err.message}`) })
                result['attachments'] = attachments;
                result['errors'] = errs;
            }
            res.status(200).send(dispatcher(res, result));
        } catch (err) {
            next(err)
        }
    }
    protected async getData(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'MENTOR' && res.locals.role !== 'TEAM' && res.locals.role !== 'STATE') {
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
            let { role, state } = newREQQuery;
            let data: any = {}
            const where: any = {};
            where[`status`] = "ACTIVE";
            if (state !== 'All States' && state !== undefined) {
                where[`state`] = state;
            }
            if (role !== 'All roles' && role !== undefined) {
                where[`role`] = role;
            }
            const { id } = req.params;
            if (id) {
                const newParamId = await this.authService.decryptGlobal(req.params.id);
                where[`popup_id`] = newParamId;
                data = await this.crudService.findOne(popup, {
                    where: [where]
                })
            }
            else {
                data = await this.crudService.findAll(popup, {
                    where: [where]
                })
                if (data.length <= 0){
                    where[`state`] = "All States" 
                    data = await this.crudService.findAll(popup, {
                        where: [where]
                    })
                }
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    }
}