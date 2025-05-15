import { worksheetSchema, worksheetUpdateSchema } from "../validations/worksheet.validations";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import { NextFunction, Request, Response } from "express";
import { notFound, unauthorized } from "boom";
import { speeches } from "../configs/speeches.config";
import db from "../utils/dbconnection.util"
import dispatcher from "../utils/dispatch.util";
import { constents } from "../configs/constents.config";
import { Op } from "sequelize";
export default class WorksheetController extends BaseController {

    model = "worksheet";

    protected initializePath(): void {
        this.path = '/worksheets';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(worksheetSchema, worksheetUpdateSchema);
    }
    protected initializeRoutes(): void {
        super.initializeRoutes();
    }
    //fetching worksheet or student support file 
    protected async getData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let data: any;
            const { model, id } = req.params;
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const paramStatus: any = newREQQuery.status;
            if (model) {
                this.model = model;
            };

            let user_id = res.locals.user_id;
            if (!user_id) {
                throw unauthorized(speeches.UNAUTHORIZED_ACCESS)
            }

            // pagination
            const { page, size, title } = newREQQuery;
            let condition = title ? { title: { [Op.like]: `%${title}%` } } : null;
            const { limit, offset } = this.getPagination(page, size);
            const modelClass = await this.loadModel(model).catch(error => {
                next(error)
            });
            const where: any = {};
            let whereClauseStatusPart: any = {}
            let boolStatusWhereClauseRequired = false;
            if (paramStatus && (paramStatus in constents.common_status_flags.list)) {
                if (paramStatus === 'ALL') {
                    whereClauseStatusPart = {};
                    boolStatusWhereClauseRequired = false;
                } else {
                    whereClauseStatusPart = { "status": paramStatus };
                    boolStatusWhereClauseRequired = true;
                }
            } else {
                whereClauseStatusPart = { "status": "ACTIVE" };
                boolStatusWhereClauseRequired = true;
            }
            if (id) {
                const newParamId = await this.authService.decryptGlobal(req.params.id);
                where[`${this.model}_id`] = newParamId;
                data = await this.crudService.findOne(modelClass, {
                    where: {
                        [Op.and]: [
                            whereClauseStatusPart,
                            where,
                        ]
                    },
                    attributes: [
                        "worksheet_id",
                        "attachments",
                        "status",
                        "description",
                        "updated_at",
                        [
                            // Note the wrapping parentheses in the call below!
                            db.literal(`(
                                SELECT CASE WHEN EXISTS 
                                    (SELECT attachments 
                                    FROM worksheet_responses as wr 
                                    WHERE wr.user_id = ${user_id} 
                                    AND wr.worksheet_id = \`worksheet\`.\`worksheet_id\`)
                                THEN  
                                    (SELECT attachments 
                                    FROM worksheet_responses as wr 
                                    WHERE wr.user_id = ${user_id} 
                                    AND wr.worksheet_id = \`worksheet\`.\`worksheet_id\`
                                    ORDER BY wr.updated_at DESC
                                    LIMIT 1)
                                ELSE 
                                    NULL
                                END as response
                            )`),
                            'response'
                        ],
                    ]
                });
            } else {
                try {
                    const responseOfFindAndCountAll = await this.crudService.findAndCountAll(modelClass, {
                        where: {
                            [Op.and]: [
                                whereClauseStatusPart,
                                condition
                            ]
                        },
                        attributes: [
                            "worksheet_id",
                            "attachments",
                            "status",
                            "description",
                            "updated_at",
                            [
                                // Note the wrapping parentheses in the call below!
                                db.literal(`(
                                    SELECT CASE WHEN EXISTS 
                                        (SELECT attachments 
                                        FROM worksheet_responses as wr 
                                        WHERE wr.user_id = ${user_id} 
                                        AND wr.worksheet_id = \`worksheet\`.\`worksheet_id\`) 
                                    THEN  
                                        (SELECT attachments 
                                        FROM worksheet_responses as wr 
                                        WHERE wr.user_id = ${user_id} 
                                        AND wr.worksheet_id = \`worksheet\`.\`worksheet_id\` 
                                        ORDER BY wr.updated_at DESC
                                        LIMIT 1)
                                    ELSE 
                                        NULL
                                    END as response
                                )`),
                                'response'
                            ],
                        ],
                        limit,
                        offset
                    })
                    const result = this.getPagingData(responseOfFindAndCountAll, page, limit);
                    data = result;
                } catch (error: any) {
                    return res.status(500).send(dispatcher(res, data, 'error'))
                }

            }
            if (!data || data instanceof Error) {
                if (data != null) {
                    throw notFound(data.message)
                } else {
                    throw notFound()
                }
            }

            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            next(error);
        }
    }
} 
