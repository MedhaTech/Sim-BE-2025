import { Request, Response, NextFunction } from "express";
import { mentor } from "../models/mentor.model";
import { organization } from "../models/organization.model";
import dispatcher from "../utils/dispatch.util";
import db from "../utils/dbconnection.util"
import { quiz_survey_response } from '../models/quiz_survey_response.model';
import BaseController from "./base.controller";
import { constents } from "../configs/constents.config";
import { mentor_course_topic } from "../models/mentor_course_topic.model";
import { internal, notFound } from "boom";
import { speeches } from "../configs/speeches.config";
import { Op, QueryTypes } from 'sequelize';
import { user } from "../models/user.model";
import { team } from "../models/team.model";
import { baseConfig } from "../configs/base.config";

export default class ReportController extends BaseController {
    model = "mentor"; ///giving any name because this shouldnt be used in any apis in this controller
    protected initializePath(): void {
        this.path = '/reports';
    }
    protected initializeValidations(): void {
    }
    protected initializeRoutes(): void {
        this.router.get(this.path + "/mentorsummary", this.mentorsummary.bind(this));
        this.router.get(this.path + "/mentorRegList", this.getMentorRegList.bind(this));
        this.router.get(this.path + "/notRegistered", this.notRegistered.bind(this));
    }
    protected async mentorsummary(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'REPORT' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let data: any = {}
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const state = newREQQuery.state;
            let summary
            if (state) {
                summary = await db.query(`SELECT 
                org.state,
                org.ATL_Count,
                org.ATL_Reg_Count,
                (org.ATL_Count - org.ATL_Reg_Count) AS total_not_Reg_ATL,
                org.NONATL_Reg_Count,
                org.male_mentor_count,
                org.female_mentor_count,
                org.male_mentor_count + org.female_mentor_count AS total_registered_teachers
            FROM
                (SELECT 
                    o.state,
                        COUNT(CASE
                            WHEN o.category = 'ATL' THEN 1
                        END) AS ATL_Count,
                        COUNT(CASE
                            WHEN
                                m.mentor_id <> 'null'
                                    AND o.category = 'ATL'
                            THEN
                                1
                        END) AS ATL_Reg_Count,
                        COUNT(CASE
                            WHEN
                                m.mentor_id <> 'null'
                                    AND o.category = 'Non ATL'
                            THEN
                                1
                        END) AS NONATL_Reg_Count,
                        SUM(CASE
                            WHEN m.gender = 'Male' THEN 1
                            ELSE 0
                        END) AS male_mentor_count,
                        SUM(CASE
                            WHEN m.gender = 'Female' THEN 1
                            ELSE 0
                        END) AS female_mentor_count
                FROM
                    organizations o
                LEFT JOIN mentors m ON o.organization_code = m.organization_code
                WHERE
                    o.status = 'ACTIVE' && o.state= '${state}'
                GROUP BY o.state) AS org`, { type: QueryTypes.SELECT });

            } else {
                summary = await db.query(`SELECT 
            org.state,
            org.ATL_Count,
            org.ATL_Reg_Count,
            (org.ATL_Count - org.ATL_Reg_Count) AS total_not_Reg_ATL,
            org.NONATL_Reg_Count,
            org.male_mentor_count,
            org.female_mentor_count,
            org.male_mentor_count + org.female_mentor_count AS total_registered_teachers
        FROM
            (SELECT 
                o.state,
                    COUNT(CASE
                        WHEN o.category = 'ATL' THEN 1
                    END) AS ATL_Count,
                    COUNT(CASE
                        WHEN
                            m.mentor_id <> 'null'
                                AND o.category = 'ATL'
                        THEN
                            1
                    END) AS ATL_Reg_Count,
                    COUNT(CASE
                        WHEN
                            m.mentor_id <> 'null'
                                AND o.category = 'Non ATL'
                        THEN
                            1
                    END) AS NONATL_Reg_Count,
                    SUM(CASE
                        WHEN m.gender = 'Male' THEN 1
                        ELSE 0
                    END) AS male_mentor_count,
                    SUM(CASE
                        WHEN m.gender = 'Female' THEN 1
                        ELSE 0
                    END) AS female_mentor_count
            FROM
                organizations o
            LEFT JOIN mentors m ON o.organization_code = m.organization_code
            WHERE
                o.status = 'ACTIVE'
            GROUP BY o.state) AS org 
        UNION ALL SELECT 
            'Total',
            SUM(ATL_Count),
            SUM(ATL_Reg_Count),
            SUM(ATL_Count - ATL_Reg_Count),
            SUM(NONATL_Reg_Count),
            SUM(male_mentor_count),
            SUM(female_mentor_count),
            SUM(male_mentor_count + female_mentor_count)
        FROM
            (SELECT 
                o.state,
                    COUNT(CASE
                        WHEN o.category = 'ATL' THEN 1
                    END) AS ATL_Count,
                    COUNT(CASE
                        WHEN
                            m.mentor_id <> 'null'
                                AND o.category = 'ATL'
                        THEN
                            1
                    END) AS ATL_Reg_Count,
                    COUNT(CASE
                        WHEN
                            m.mentor_id <> 'null'
                                AND o.category = 'Non ATL'
                        THEN
                            1
                    END) AS NONATL_Reg_Count,
                    SUM(CASE
                        WHEN m.gender = 'Male' THEN 1
                        ELSE 0
                    END) AS male_mentor_count,
                    SUM(CASE
                        WHEN m.gender = 'Female' THEN 1
                        ELSE 0
                    END) AS female_mentor_count
            FROM
                organizations o
            LEFT JOIN mentors m ON o.organization_code = m.organization_code
            WHERE
                o.status = 'ACTIVE'
            GROUP BY o.state) AS org;`, { type: QueryTypes.SELECT });
            }
            data = summary;
            if (!data) {
                throw notFound(speeches.DATA_NOT_FOUND)
            }
            if (data instanceof Error) {
                throw data
            }
            res.status(200).send(dispatcher(res, data, "success"))
        } catch (err) {
            next(err)
        }
    }
    protected async getMentorRegList(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if(res.locals.role !== 'ADMIN' && res.locals.role !== 'REPORT' && res.locals.role !== 'STATE'){
            return res.status(401).send(dispatcher(res,'','error', speeches.ROLE_ACCES_DECLINE,401));
        } 
        try {
            
            let newREQQuery : any = {}
            if(req.query.Data){
                let newQuery : any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery  = JSON.parse(newQuery);
            }else if(Object.keys(req.query).length !== 0){
                return res.status(400).send(dispatcher(res,'','error','Bad Request',400));
            }
            const { page, size, status ,district,category,state} = newREQQuery;
            const { limit, offset } = this.getPagination(page, size);
            const paramStatus: any = newREQQuery.status;
            let whereClauseStatusPart: any = {};
            let addWhereClauseStatusPart = false
            if (paramStatus && (paramStatus in constents.common_status_flags.list)) {
                if (paramStatus === 'ALL') {
                    whereClauseStatusPart = {};
                    addWhereClauseStatusPart = false;
                } else {
                    whereClauseStatusPart = { "status": paramStatus };
                    addWhereClauseStatusPart = true;
                }
            } else {
                whereClauseStatusPart = { "status": "ACTIVE" };
                addWhereClauseStatusPart = true;
            }
            let districtFilter: any = {}
            if(district !== 'All Districts' && category !== 'All Categorys' && state!=='All States'){
                districtFilter = {category,district,status,state}
            }else if(district !== 'All Districts'){
                districtFilter = {district,status}
            }else if(category !== 'All Categorys'){
                districtFilter = {category,status}
            }else if(state!=='All States'){
                districtFilter = {status,state}
            }
            else{
                districtFilter={status}
            }
            const mentorsResult = await mentor.findAll({
                attributes: [
                    "full_name",
                    "gender",
                    "mobile",
                    "whatapp_mobile",
                ],
                raw: true,
                where: {
                    [Op.and]: [
                        whereClauseStatusPart
                    ]
                },
                include: [
                    {
                        where: districtFilter,
                        model: organization,
                        attributes: [
                            "organization_code",
                            "unique_code",
                            "organization_name",
                            "category",
                            "state",
                            "district",
                            "city",
                            "pin_code",
                            "address",
                            "principal_name",
                            "principal_mobile"
                        ]
                    },
                    {
                        model: user,
                        attributes: [
                            "username",
                            "user_id"
                        ]
                    }
                ],
                limit, offset
            });
            if (!mentorsResult) {
                throw notFound(speeches.DATA_NOT_FOUND)
            }
            if (mentorsResult instanceof Error) {
                throw mentorsResult
            }
            res.status(200).send(dispatcher(res, mentorsResult, "success"))
        } catch (err) {
            next(err)
        }
    }
    protected async notRegistered(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if(res.locals.role !== 'ADMIN' && res.locals.role !== 'REPORT' && res.locals.role !== 'STATE'){
            return res.status(401).send(dispatcher(res,'','error', speeches.ROLE_ACCES_DECLINE,401));
        }
        try {
            let newREQQuery : any = {}
            if(req.query.Data){
                let newQuery : any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery  = JSON.parse(newQuery);
            }else if(Object.keys(req.query).length !== 0){
                return res.status(400).send(dispatcher(res,'','error','Bad Request',400));
            }
            const { district,category,state } = newREQQuery;

            let districtFilter: any = ''
            let categoryFilter:any = ''
            let stateFilter:any = ''
            if(district !== 'All Districts' && category !== 'All Categorys' && state!== 'All States'){
                districtFilter = `'${district}'`
                categoryFilter = `'${category}'`
                stateFilter = `'${state}'`
            }else if(district !== 'All Districts'){
                districtFilter = `'${district}'`
                categoryFilter = `'%%'`
                stateFilter = `'%%'`
            }else if(category !== 'All Categorys'){
                categoryFilter = `'${category}'`
                districtFilter = `'%%'`
                stateFilter = `'%%'`
            }else if(state !== 'All States'){
                stateFilter = `'${state}'`
                districtFilter = `'%%'`
                categoryFilter = `'%%'`
            }
            else{
                districtFilter = `'%%'`
                categoryFilter = `'%%'`
                stateFilter = `'%%'`
            }
            const mentorsResult = await db.query(`SELECT 
            organization_id,
            organization_code,
            unique_code,
            organization_name,
            district,
            state,
            category,
            city,
            state,
            country,
            pin_code,
            address,
            principal_name,
            principal_mobile,
            principal_email FROM organizations WHERE status='ACTIVE' && district LIKE ${districtFilter} && category LIKE ${categoryFilter} && state LIKE ${stateFilter} && NOT EXISTS(SELECT mentors.organization_code  from mentors WHERE organizations.organization_code = mentors.organization_code) `, { type: QueryTypes.SELECT });
            if (!mentorsResult) {
                throw notFound(speeches.DATA_NOT_FOUND)
            }
            if (mentorsResult instanceof Error) {
                throw mentorsResult
            }
            res.status(200).send(dispatcher(res, mentorsResult, "success"))
        } catch (err) {
            next(err)
        }
    }

}
