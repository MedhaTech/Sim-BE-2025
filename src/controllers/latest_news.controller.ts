import { latest_news } from "../models/latest_news.model";
import BaseController from "./base.controller";
import { Request, Response, NextFunction } from 'express';
import { unauthorized } from "boom";
import dispatcher from "../utils/dispatch.util";
import ValidationsHolder from "../validations/validationHolder";
import { latest_newsSchema, latest_newsUpdateSchema } from '../validations/latest_news.validation';
import { S3 } from "aws-sdk";
import fs from 'fs';
import { speeches } from "../configs/speeches.config";
import { HttpsProxyAgent } from "https-proxy-agent";
import path from "path";

export default class LatestNewsController extends BaseController {

    model = "latest_news";

    protected initializePath(): void {
        this.path = '/latest_news';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(latest_newsSchema, latest_newsUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.post(`${this.path}/latestnewsFileUpload`, this.handleAttachment.bind(this));
        super.initializeRoutes();
    }

    //fetching all latest news details and single latest news by latest_news_id
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
            let { category, state } = newREQQuery;
            let data: any = {}
            const where: any = {};
            where[`status`] = "ACTIVE";
            if (state !== 'All States' && state !== undefined) {
                where[`state`] = state;
            }
            if (category !== 'All categorys' && category !== undefined) {
                where[`category`] = category;
            }
            const { id } = req.params;
            if (id) {
                const newParamId = await this.authService.decryptGlobal(req.params.id);
                where[`latest_news_id`] = newParamId;
                data = await this.crudService.findOne(latest_news, {
                    attributes: [
                        "latest_news_id",
                        "details",
                        "category",
                        "url",
                        "file_name",
                        "new_status",
                        "state",
                        "updated_at"
                    ],
                    where: [where]
                })
            }
            else {
                data = await this.crudService.findAll(latest_news, {
                    attributes: [
                        "latest_news_id",
                        "details",
                        "category",
                        "url",
                        "file_name",
                        "new_status",
                        "state",
                        "updated_at"
                    ],
                    where: [where]
                })
                if (data.length <= 0) {
                    where[`state`] = "All States"
                    data = await this.crudService.findAll(latest_news, {
                        attributes: [
                            "latest_news_id",
                            "details",
                            "category",
                            "url",
                            "file_name",
                            "new_status",
                            "state",
                            "updated_at"
                        ],
                        where: [where]
                    })
                }
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    }

    //storing files in the s3 bucket
    protected async handleAttachment(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const allowedTypes = ['image/jpeg', 'image/png', 'application/msword', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            let file_name_prefix: any;
            if (process.env.DB_HOST?.includes("stage")) {
                file_name_prefix = `LatestNews/stage/LN`
            } else if (process.env.DB_HOST?.includes("dev")) {
                file_name_prefix = `LatestNews/dev/LN`
            } else {
                file_name_prefix = `LatestNews/LN`
            }
            const result = await this.authService.AzureFileupload(req.files, file_name_prefix, allowedTypes);
            res.status(200).send(dispatcher(res, result));
        }
        catch (err) {
            next(err)
        }
    }
}