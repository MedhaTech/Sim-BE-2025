import { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import { speeches } from "../configs/speeches.config";
import dispatcher from "../utils/dispatch.util";
import { supportTickets, supportTicketsUpdateSchema } from "../validations/supportTicket.validation";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import db from "../utils/dbconnection.util";
import { support_ticket_reply } from "../models/support_ticket_reply.model";
import { badRequest } from "boom";
import { S3 } from "aws-sdk";
import fs from 'fs';
import { HttpsProxyAgent } from "https-proxy-agent";
import path from "path";


export default class SupportTicketController extends BaseController {

    model = "support_ticket"

    protected initializePath(): void {
        this.path = "/supportTickets";
    };
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(supportTickets, supportTicketsUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.post(`${this.path}/supportTicketFileUpload`, this.handleAttachment.bind(this));
        super.initializeRoutes();
    }
    //fetching all support_ticket details and single support_ticket by support_ticket_id
    protected async getData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let data: any;
            const { model, id } = req.params;
            if (model) {
                this.model = model;
            };
            // pagination
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const { page, size, status, user_id, state } = newREQQuery;
            let condition = status ? { status: { [Op.like]: `%${status}%` } } : null;
            let stateFilter = state ? { state: { [Op.like]: `%${state}%` } } : null;
            let filteringBasedOnUser_id = user_id ? { created_by: user_id } : null;
            const { limit, offset } = this.getPagination(page, size);
            const modelClass = await this.loadModel(model).catch(error => {
                next(error)
            });
            const where: any = {};
            if (id) {
                const newParamId = await this.authService.decryptGlobal(req.params.id);
                where[`${this.model}_id`] = newParamId;
                data = await this.crudService.findOne(modelClass, {
                    attributes: [
                        [
                            db.literal(`(SELECT organization_code FROM mentors As s WHERE s.user_id = \`support_ticket\`.\`created_by\` )`), 'organization_code'
                        ],
                        [
                            db.literal(`(SELECT o.district FROM organizations as o join mentors as m on o.organization_code = m.organization_code where user_id = \`support_ticket\`.\`created_by\` )`), 'district'
                        ],
                        [
                            db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`support_ticket\`.\`created_by\` )`), 'created_by'
                        ],
                        [
                            db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`support_ticket\`.\`updated_by\` )`), 'updated_by'
                        ],
                        [
                            db.literal(`( SELECT COUNT(*) FROM support_tickets_replies AS s WHERE s.support_ticket_id = \`support_ticket\`.\`support_ticket_id\`)`), 'replies_count'
                        ],
                        'support_ticket_id',
                        'query_category',
                        'query_details',
                        "link",
                        "file",
                        'status',
                        'created_at',
                        'updated_at',
                        'state'
                    ],
                    where: {
                        [Op.and]: [
                            where
                        ]
                    },
                    include: {
                        attributes: [
                            "support_tickets_reply_id",
                            "link",
                            "file",
                            "replied_by",
                            "reply_details",
                            "status",
                            "created_at",
                            "updated_at",
                            [
                                db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`support_ticket_replies\`.\`created_by\` )`), 'created_by'
                            ],
                            [
                                db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`support_ticket_replies\`.\`updated_by\` )`), 'updated_by'
                            ],
                        ],
                        model: support_ticket_reply,
                        required: false
                    }
                });
            } else {
                try {
                    const responseOfFindAndCountAll = await this.crudService.findAndCountAll(modelClass, {
                        attributes: [
                            'support_ticket_id',
                            'query_category',
                            'query_details',
                            'status',
                            'created_at',
                            'updated_at',
                            "link",
                            "file",
                            'state',
                            [
                                db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`support_ticket\`.\`created_by\` )`), 'created_by'
                            ],
                            [
                                db.literal(`(SELECT full_name FROM users As s WHERE s.user_id = \`support_ticket\`.\`updated_by\` )`), 'updated_by'
                            ],
                            [
                                db.literal(`( SELECT COUNT(*) FROM support_tickets_replies AS s WHERE s.support_ticket_id = \`support_ticket\`.\`support_ticket_id\`)`), 'replies_count'
                            ],
                            [
                                db.literal(`(SELECT organization_code FROM mentors As s WHERE s.user_id = \`support_ticket\`.\`created_by\` )`), 'organization_code'
                            ],
                            [
                                db.literal(`(SELECT o.district FROM organizations as o join mentors as m on o.organization_code = m.organization_code where user_id = \`support_ticket\`.\`created_by\` )`), 'district'
                            ],

                        ],
                        where: {
                            [Op.and]: [
                                stateFilter,
                                condition,
                                filteringBasedOnUser_id
                            ]
                        },
                        limit, offset,
                        order: [["updated_at", "DESC"]],
                    })
                    const result = this.getPagingData(responseOfFindAndCountAll, page, limit);
                    data = result;
                } catch (error: any) {
                    return res.status(500).send(dispatcher(res, data, 'error'))
                }
            }
            if (!data || data instanceof Error) {
                res.status(200).send(dispatcher(res, null, "error", speeches.DATA_NOT_FOUND));
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    };
    //updating support_ticket details by support_ticket_id
    protected async updateData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { model, id } = req.params;
            if (model) {
                this.model = model;
            };
            const where: any = {};
            const user_id = res.locals.user_id
            const modelLoaded = await this.loadModel(model);
            let payload: any = req.body;
            payload['updated_by'] = user_id;
            const newParamId: any = await this.authService.decryptGlobal(req.params.id);
            where[`${this.model}_id`] = JSON.parse(newParamId);
            const data = await this.crudService.update(modelLoaded, payload, { where: where });
            if (!data) {
                throw badRequest()
            }
            if (data instanceof Error) {
                throw data;
            }
            return res.status(200).send(dispatcher(res, data, 'updated'));
        } catch (error) {
            next(error);
        }
    }
    //storing files in the s3 bucket
    protected async handleAttachment(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const allowedTypes = ['image/jpeg', 'image/png', 'application/msword', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            let file_name_prefix: any;
            if (process.env.DB_HOST?.includes("stage")) {
                file_name_prefix = `supportTickets/stage/ST`
            } else if (process.env.DB_HOST?.includes("dev")) {
                file_name_prefix = `supportTickets/dev/ST`
            } else {
                file_name_prefix = `supportTickets/ST`
            }
            const result = await this.authService.AzureFileupload(req.files, file_name_prefix, allowedTypes);
            res.status(200).send(dispatcher(res, result));
        }
        catch (err) {
            next(err)
        }
    }
};