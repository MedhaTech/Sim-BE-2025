import { resource } from "../models/resource.model";
import BaseController from "./base.controller";
import { Request, Response, NextFunction } from 'express';
import { notFound, unauthorized } from "boom";
import dispatcher from "../utils/dispatch.util";
import ValidationsHolder from "../validations/validationHolder";
import { resourceSchema, resourceUpdateSchema } from '../validations/resource.validations';
import { S3 } from "aws-sdk";
import fs from 'fs';
import { speeches } from "../configs/speeches.config";
import { HttpsProxyAgent } from "https-proxy-agent";
import path from "path";

export default class ResourceController extends BaseController {

    model = "resource";

    protected initializePath(): void {
        this.path = '/resource';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(resourceSchema, resourceUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.post(`${this.path}/resourceFileUpload`, this.handleAttachment.bind(this));
        super.initializeRoutes();
    }
    //fetching all resource details and single resource by resource_id
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
            let { role, state, type } = newREQQuery;
            let data: any = {}
            const where: any = {};
            where[`status`] = "ACTIVE";
            if (state !== 'All States' && state !== undefined) {
                where[`state`] = state
            }
            if (role !== 'All roles' && role !== undefined) {
                where[`role`] = role;
            }
            const { id } = req.params;
            if (id) {
                const newParamId = await this.authService.decryptGlobal(req.params.id);
                where[`resource_id`] = newParamId;
                data = await this.crudService.findOne(resource, {
                    attributes: [
                        "resource_id",
                        "description",
                        "role",
                        "type",
                        "attachments",
                        "state"
                    ],
                    where: [where],
                    order: [['resource_id', 'DESC']]
                })
            }
            else if (type === 'state') {
                where[`state`] = state
                data = await this.crudService.findAll(resource, {
                    attributes: [
                        "resource_id",
                        "description",
                        "role",
                        "type",
                        "attachments",
                        "state"
                    ],
                    where: [where],
                    order: [['resource_id', 'DESC']]
                })
            }
            else {
                data = await this.crudService.findAll(resource, {
                    attributes: [
                        "resource_id",
                        "description",
                        "role",
                        "type",
                        "attachments",
                        "state"
                    ],
                    where: [where],
                    order: [['resource_id', 'DESC']]
                })
                if (data.length <= 0) {
                    where[`state`] = "All States"
                    data = await this.crudService.findAll(resource, {
                        attributes: [
                            "resource_id",
                            "description",
                            "role",
                            "type",
                            "attachments",
                            "state"
                        ],
                        where: [where],
                        order: [['resource_id', 'DESC']]
                    })
                }
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    }
    //storing files in the s3 bucket
    // protected async handleAttachment(req: Request, res: Response, next: NextFunction) {
    //     if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STATE') {
    //         return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
    //     }
    //     try {
    //         const rawfiles: any = req.files;
    //         const files: any = Object.values(rawfiles);
    //         const allowedTypes = ['image/jpeg', 'image/png', 'application/msword', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    //         if (!allowedTypes.includes(files[0].type)) {
    //             return res.status(400).send(dispatcher(res, '', 'error', 'This file type not allowed', 400));
    //         }
    //         const errs: any = [];
    //         let attachments: any = [];
    //         let result: any = {};
    //         let proxyAgent = new HttpsProxyAgent('http://10.236.241.101:9191');
    //         let s3
    //         if (process.env.ISAWSSERVER === 'YES') {
    //             s3 = new S3({
    //                 apiVersion: '2006-03-01',
    //                 region: process.env.AWS_REGION,
    //                 accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    //                 secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    //             });
    //         } else {
    //             s3 = new S3({
    //                 apiVersion: '2006-03-01',
    //                 region: process.env.AWS_REGION,
    //                 accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    //                 secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    //                 httpOptions: { agent: proxyAgent }
    //             });
    //         }
    //         if (!req.files) {
    //             return result;
    //         }
    //         let file_name_prefix: any;
    //         if (process.env.DB_HOST?.includes("prod")) {
    //             file_name_prefix = `resources`
    //         } else if (process.env.DB_HOST?.includes("dev")) {
    //             file_name_prefix = `resources/dev`
    //         } else {
    //             file_name_prefix = `resources/stage`
    //         }
    //         for (const file_name of Object.keys(files)) {
    //             const file = files[file_name];
    //             const readFile: any = await fs.readFileSync(file.path);
    //             if (readFile instanceof Error) {
    //                 errs.push(`Error uploading file: ${file.originalFilename} err: ${readFile}`)
    //             }
    //             let newDate = new Date();
    //             let newFormat = (newDate.getFullYear()) + "-" + (1 + newDate.getMonth()) + "-" + newDate.getUTCDate() + '_' + newDate.getHours() + '-' + newDate.getMinutes() + '-' + newDate.getSeconds();
    //             let params = {
    //                 Bucket: `${process.env.BUCKET}`,
    //                 Key: `${file_name_prefix}/R${newFormat}${path.extname(file.name).toLowerCase()}`,
    //                 Body: readFile,
    //                 ContentDisposition: 'inline'
    //             };
    //             let options: any = { partSize: 20 * 1024 * 1024, queueSize: 2 };
    //             await s3.upload(params, options).promise()
    //                 .then((data: any) => { attachments.push(data.Location) })
    //                 .catch((err: any) => { errs.push(`Error uploading file: ${file.originalFilename}, err: ${err.message}`) })
    //             result['attachments'] = attachments;
    //             result['errors'] = errs;
    //         }
    //         res.status(200).send(dispatcher(res, result));
    //     } catch (err) {
    //         next(err)
    //     }
    // }
    protected async handleAttachment(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const rawfiles: any = req.files;
            const files: any = Object.values(rawfiles);
            const allowedTypes = ['image/jpeg', 'image/png', 'application/msword', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!allowedTypes.includes(files[0].type)) {
                return res.status(400).send(dispatcher(res, '', 'error', 'This file type not allowed', 400));
            }
             let file_name_prefix: any;
            if (process.env.DB_HOST?.includes("stage")) {
                file_name_prefix = `resources/stage/R`
            } else if (process.env.DB_HOST?.includes("dev")) {
                file_name_prefix = `resources/dev/R`
            } else {
                file_name_prefix = `resources/R`
            }
            const result = await this.authService.AzureFileupload(files,file_name_prefix);
            if (result.error) {
                return res.status(400).send(dispatcher(res, result.error, 'error', result.error));
            } else {
                return res.status(200).send(dispatcher(res, result.data, 'success'));
            }
        }
        catch (err) {
            next(err)
        }
    }
}