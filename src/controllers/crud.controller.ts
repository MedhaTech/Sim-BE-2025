import e, { Router, Request, Response, NextFunction, response } from 'express';
import path from 'path';
import * as csv from "fast-csv";
import { Op } from 'sequelize';
import fs, { stat } from 'fs';
import IController from '../interfaces/controller.interface';
import HttpException from '../utils/exceptions/http.exception';
import CRUDService from '../services/crud.service';
import { badRequest, notFound } from 'boom';
import dispatcher from '../utils/dispatch.util';
import { speeches } from '../configs/speeches.config';
import { constents } from '../configs/constents.config';
import authService from '../services/auth.service';

export default class CRUDController implements IController {
    model: string = "";
    public path = "";
    public statusFlagsToUse:any = []
    public router = Router();
    crudService: CRUDService = new CRUDService();
    authService: authService = new authService;

    constructor() {
        this.init();
    }

    protected init(): void {
        this.initializeStatusFlags()
        this.initializePath();
        this.initializeRoutes();
    }

    protected initializePath() {
        this.path = '/crud';
    }

    protected initializeStatusFlags() {
        this.statusFlagsToUse = constents.common_status_flags.list;
    }


    protected initializeRoutes(aditionalrouts: any = []): void {
        this.router.get(`${this.path}/:model`, this.getData.bind(this));
        this.router.get(`${this.path}/:model/:id`, this.getData.bind(this));
        this.router.post(`${this.path}/:model`, this.createData.bind(this));
        this.router.put(`${this.path}/:model/:id`, this.updateData.bind(this));
        this.router.delete(`${this.path}/:model/:id`, this.deleteData.bind(this));
    }

    protected async loadModel(model: string): Promise<Response | void | any> {
        const modelClass = await import(`../models/${model}.model`);
        return modelClass[model];
    };

    protected getPagination(page: any, size: any) {
        const limit = size ? +size : 1000000;
        const offset = page ? page * limit : 0;
        return { limit, offset };
    };

    protected getPagingData(data: any, page: any, limit: any) {
        const { count: totalItems, rows: dataValues } = data;
        const currentPage = page ? +page : 0;
        const totalPages = Math.ceil(totalItems / limit);
        return { totalItems, dataValues, totalPages, currentPage };
    };

    protected autoFillTrackingColumns(req: Request, res: Response, modelLoaded: any, reqData: any = null) {
        // console.log(res.locals);
        let payload = req.body;
        if (reqData != null) {
            payload = reqData
        }
        if (modelLoaded.rawAttributes.created_by !== undefined) {
            payload['created_by'] = res.locals.user_id;
        }
        if (modelLoaded.rawAttributes.updated_by !== undefined) {
            payload['updated_by'] = res.locals.user_id;
        }

        return payload;
    }


    protected async getData(req: Request, res: Response, next: NextFunction,
        findQueryWhereClauseArr:any=[],
        findQueryAttrs:any={exclude:[]},
        findQueryinclude:any=null,
        findQueryOrderArr:any=[]
        ): Promise<Response | void> {
        try {
            let newREQQuery : any = {}
            if(req.query.Data){
                let newQuery : any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery  = JSON.parse(newQuery);
            }else if(Object.keys(req.query).length !== 0){
                return res.status(400).send(dispatcher(res,'','error','Bad Request',400));
            }
            let data: any;
            const { model, id } = req.params;
            const paramStatus: any = newREQQuery.status;
            if (model) {
                this.model = model;
            };
            // pagination
            const { page, size } = newREQQuery;
            // let condition = status ? { status: { [Op.like]: `%${status}%` } } : null;
            const { limit, offset } = this.getPagination(page, size);
            const modelClass = await this.loadModel(model).catch(error => {
                next(error)
            });
            const where: any = {};
            let objwhereClauseStatusPart = this.getWhereClauseStatsPart(newREQQuery);

            if (id) {
                const newParamId : any = await this.authService.decryptGlobal(req.params.id);
                
                where[`${this.model}_id`] = JSON.parse(newParamId);
                data = await this.crudService.findOne(modelClass, {
                    attributes:findQueryAttrs,
                    where: {
                        [Op.and]: [
                            objwhereClauseStatusPart.whereClauseStatusPart,
                            where,
                            ...findQueryWhereClauseArr
                        ]
                    },
                    include:findQueryinclude,
                    order:findQueryOrderArr
                });
            } else {
                try {
                    const responseOfFindAndCountAll = await this.crudService.findAndCountAll(modelClass, {
                        attributes:findQueryAttrs,
                        where: {
                            [Op.and]: [
                                objwhereClauseStatusPart.whereClauseStatusPart,
                                ...findQueryWhereClauseArr
                            ]
                        },
                        include:findQueryinclude,
                        limit, offset,
                        order:findQueryOrderArr
                    })
                    const result = this.getPagingData(responseOfFindAndCountAll, page, limit);
                    data = result;
                } catch (error: any) {
                    console.log(error)
                    //  res.status(500).send(dispatcher(res,data, 'error'))
                    next(error)
                }

            }
            // if (!data) {
            //     return res.status(404).send(dispatcher(res,data, 'error'));
            // }
            if (!data || data instanceof Error) {
                if (data != null) {
                    throw notFound(data.message)
                } else {
                    throw notFound()
                }
                res.status(200).send(dispatcher(res,null, "error", speeches.DATA_NOT_FOUND));
                // if(data!=null){
                //     throw 
                (data.message)
                // }else{
                //     throw notFound()
                // }
            }
            return res.status(200).send(dispatcher(res,data, 'success'));
        } catch (error) {
            console.log(error)
            next(error);
        }
    }
    
    protected async createData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { model } = req.params;
            if (model) {
                this.model = model;
            };
            const modelLoaded = await this.loadModel(model);
            const payload = this.autoFillTrackingColumns(req, res, modelLoaded)
            const data = await this.crudService.create(modelLoaded, payload);
            // console.log(data)
            // if (!data) {
            //     return res.status(404).send(dispatcher(res,data, 'error'));
            // }
            if(!data){
                throw badRequest()
            }
            if ( data instanceof Error) {
                throw data;
            }
            
            return res.status(201).send(dispatcher(res,data, 'created'));
        } catch (error) {
            next(error);
        }
    }

    protected async updateData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { model, id } = req.params;
            if (model) {
                this.model = model;
            };
            const user_id = res.locals.user_id
            const where: any = {};
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            where[`${this.model}_id`] = newParamId;
            const modelLoaded = await this.loadModel(model);
            const payload = this.autoFillTrackingColumns(req, res, modelLoaded)
            const data = await this.crudService.update(modelLoaded, payload, { where: where });
            // if (!data) {
            //     return res.status(404).send(dispatcher(res,data, 'error'));
            // }
            if(!data){
                throw badRequest()
            }
            if (data instanceof Error) {
                throw data;
            }
            return res.status(200).send(dispatcher(res,data, 'updated'));
        } catch (error) {
            next(error);
        }
    }

    protected async deleteData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const { model, id } = req.params;
            if (model) {
                this.model = model;
            };
            const where: any = {};
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            where[`${this.model}_id`] = newParamId;
            const data = await this.crudService.delete(await this.loadModel(model), { where: where });
            // if (!data) {
            //     return res.status(404).send(dispatcher(res,data, 'error'));
            // }
            if(!data){
                throw badRequest()
            }
            if (data instanceof Error) {
                throw data
            }
            return res.status(200).send(dispatcher(res,data, 'deleted'));
        } catch (error) {
            next(error);
        }
    }

    protected getWhereClauseStatsPart(req:Request):any{
        const paramStatus:any = req.query?.status ? req.query.status : false
        let whereClauseStatusPart:any = {};
        let whereClauseStatusPartLiteral = "1=1";
        let addWhereClauseStatusPart = false
        
        if (paramStatus && (paramStatus in this.statusFlagsToUse)) {
            if (paramStatus === 'ALL') {
                whereClauseStatusPart = {};
                addWhereClauseStatusPart = false;
            } else {
                whereClauseStatusPart = { "status": paramStatus };
                whereClauseStatusPartLiteral = `status = "${paramStatus}"`
                addWhereClauseStatusPart = true;
            }
        } else {
            whereClauseStatusPart = { "status": "ACTIVE" };
            whereClauseStatusPartLiteral = `status = "ACTIVE"`
            addWhereClauseStatusPart = true;
        }

        return {
            paramStatus:paramStatus,
            whereClauseStatusPart:whereClauseStatusPart,
            whereClauseStatusPartLiteral:whereClauseStatusPartLiteral,
            addWhereClauseStatusPart:addWhereClauseStatusPart
        }
    }
}