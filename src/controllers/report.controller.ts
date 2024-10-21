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
        this.router.get(`${this.path}/mentordetailstable`, this.getmentorDetailstable.bind(this));
        this.router.get(`${this.path}/mentordetailsreport`, this.getmentorDetailsreport.bind(this));
        this.router.get(`${this.path}/studentdetailstable`, this.getstudentDetailstable.bind(this));
        this.router.get(`${this.path}/studentdetailsreport`, this.getstudentDetailsreport.bind(this));
        this.router.get(`${this.path}/studentATLnonATLcount`, this.getstudentATLnonATLcount.bind(this));
        this.router.get(`${this.path}/ideadeatilreport`, this.getideaReport.bind(this));
        this.router.get(`${this.path}/ideaReportTable`, this.getideaReportTable.bind(this));
        this.router.get(`${this.path}/schoollistreport`, this.getSchoolList.bind(this));
        this.router.get(`${this.path}/schoolcategorylistreport`, this.getschoolcategorylist.bind(this));


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
            let REG_school
            let cat_gender
            if (state) {
                const categorydata = await db.query(`SELECT DISTINCT
                    category
                        FROM
                    organizations
                    WHERE
                state = '${state}'`, { type: QueryTypes.SELECT });
                const querystring: any = await this.authService.combinecategory(categorydata);
                summary = await db.query(`SELECT 
    o.district, COALESCE(eli.Eligible_school,0) as Eligible_school
FROM
    organizations AS o
        left JOIN
    (SELECT 
        COUNT(*) AS Eligible_school, district
    FROM
        organizations
    WHERE
        status = 'ACTIVE'
            && state = '${state}'
    GROUP BY district) AS eli ON o.district = eli.district
WHERE
o.status = 'ACTIVE' &&
    o.state = '${state}'
GROUP BY district ORDER BY district`, { type: QueryTypes.SELECT });
                REG_school = await db.query(`SELECT 
    COUNT(DISTINCT m.organization_code) AS reg_school,
    o.district
FROM
    mentors AS m
        JOIN
    organizations AS o ON m.organization_code = o.organization_code
WHERE
    o.status = 'ACTIVE'
        && o.state = '${state}'
        GROUP BY district;`, { type: QueryTypes.SELECT });
                cat_gender = await db.query(`
                    SELECT 
                    ${querystring.combilequery}
    COUNT(CASE
        WHEN
            m.gender = 'Female'
                AND m.mentor_id <> 'null'
        THEN
            1
    END) AS 'Female',
    COUNT(CASE
        WHEN
            m.gender = 'Male'
                AND m.mentor_id <> 'null'
        THEN
            1
    END) AS 'Male',
    COUNT(CASE
        WHEN
            m.gender NOT IN ('Male' , 'Female')
                AND m.mentor_id <> 'null'
        THEN
            1
    END) AS 'others',
    o.district
FROM
    mentors AS m
        RIGHT JOIN
    organizations AS o ON m.organization_code = o.organization_code
WHERE
    o.status = 'ACTIVE'
        && o.state = '${state}'
GROUP BY o.district
                    `, { type: QueryTypes.SELECT });
                const result = await this.authService.totalofREGsummary(summary, REG_school, cat_gender, querystring.categoryList)
                const transformedArray = Object.entries(result).map(([key, value]) => {
                    const { ...rest }: any = value;
                    return rest;
                });
                data = transformedArray
            } else {
                summary = await db.query(`SELECT 
    o.state, COALESCE(eli.Eligible_school, 0) as Eligible_school
FROM
    organizations AS o
        LEFT JOIN
    (SELECT 
        COUNT(*) AS Eligible_school, state
    FROM
        organizations
    WHERE
        status = 'ACTIVE'
    GROUP BY state) AS eli ON o.state = eli.state
    where o.status ="ACTIVE"
GROUP BY state ORDER BY state;`, { type: QueryTypes.SELECT });
                REG_school = await db.query(`SELECT 
    COUNT(DISTINCT m.organization_code) AS reg_school,
    o.state
FROM
    mentors AS m
        JOIN
    organizations AS o ON m.organization_code = o.organization_code
WHERE
    o.status = 'ACTIVE' group by state`, { type: QueryTypes.SELECT });
                cat_gender = await db.query(`SELECT 
    COUNT(CASE
        WHEN
            o.category = 'ATL'
                AND m.mentor_id <> 'null'
        THEN
            1
    END) AS 'ATL_Reg_Count',
    COUNT(CASE
        WHEN
            o.category = 'Non ATL'
                AND m.mentor_id <> 'null'
        THEN
            1
    END) AS 'NONATL_Reg_Count',
    COUNT(CASE
        WHEN
            o.category NOT IN ('ATL' , 'Non ATL')
                AND m.mentor_id <> 'null'
        THEN
            1
    END) AS 'Others_Reg_Count',
    COUNT(CASE
        WHEN
            m.gender = 'Female'
                AND m.mentor_id <> 'null'
        THEN
            1
    END) AS 'Female',
    COUNT(CASE
        WHEN
            m.gender = 'Male'
                AND m.mentor_id <> 'null'
        THEN
            1
    END) AS 'Male',
    COUNT(CASE
        WHEN
            m.gender NOT IN ('Male' , 'Female')
                AND m.mentor_id <> 'null'
        THEN
            1
    END) AS 'others',
    o.state
FROM
    mentors AS m
        RIGHT JOIN
    organizations AS o ON m.organization_code = o.organization_code
WHERE
    o.status = 'ACTIVE'
GROUP BY o.state`, { type: QueryTypes.SELECT });
                const result = await this.authService.totalofREGsummarystate(summary, REG_school, cat_gender)

                const transformedArray = Object.entries(result).map(([key, value]) => {
                    const { ...rest }: any = value;
                    return rest;
                });
                data = transformedArray
            }

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
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'REPORT' && res.locals.role !== 'STATE') {
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
            const { page, size, status, district, category, state } = newREQQuery;
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

            districtFilter['status'] = "ACTIVE"
            if (district !== 'All Districts' && district !== undefined) {
                districtFilter['district'] = district
            }
            if (category !== 'All Categories' && category !== undefined) {
                districtFilter['category'] = category
            }
            if (state !== 'All States' && state !== undefined) {
                districtFilter['state'] = state
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
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'REPORT' && res.locals.role !== 'STATE') {
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
            const { district, category, state } = newREQQuery;

            let districtFilter: any = `'%%'`
            let categoryFilter: any = `'%%'`
            let stateFilter: any = `'%%'`
            if (district !== 'All Districts' && district !== undefined) {
                districtFilter = `'${district}'`
            }
            if (category !== 'All Categories' && category !== undefined) {
                categoryFilter = `'${category}'`
            }
            if (state !== 'All States' && state !== undefined) {
                stateFilter = `'${state}'`
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
    protected async getmentorDetailstable(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            let wherefilter = '';
            let summary
            let teamCount
            let studentCountDetails
            let courseINcompleted
            let courseCompleted
            if (state) {
                wherefilter = `&& og.state= '${state}'`;
                summary = await db.query(`SELECT 
    og.district, COUNT(mn.mentor_id) AS totalReg
FROM
    organizations AS og
        LEFT JOIN
    mentors AS mn ON og.organization_code = mn.organization_code
WHERE
    og.status = 'ACTIVE' ${wherefilter}
GROUP BY og.district ORDER BY og.district;`, { type: QueryTypes.SELECT });
                teamCount = await db.query(`SELECT 
                og.district, COUNT(t.team_id) AS totalTeams
            FROM
                organizations AS og
                    INNER JOIN
                mentors AS mn ON og.organization_code = mn.organization_code
                    INNER JOIN
                teams AS t ON mn.mentor_id = t.mentor_id
                WHERE og.status='ACTIVE' ${wherefilter}
            GROUP BY og.district;`, { type: QueryTypes.SELECT });
                studentCountDetails = await db.query(`SELECT 
                og.district,
                COUNT(st.student_id) AS totalstudent,
                SUM(CASE
                    WHEN st.gender = 'MALE' THEN 1
                    ELSE 0
                END) AS male,
                SUM(CASE
                    WHEN st.gender = 'FEMALE' THEN 1
                    ELSE 0
                END) AS female
            FROM
                organizations AS og
                    INNER JOIN
                mentors AS mn ON og.organization_code = mn.organization_code
                    INNER JOIN
                teams AS t ON mn.mentor_id = t.mentor_id
                    INNER JOIN
                students AS st ON st.team_id = t.team_id
                WHERE og.status='ACTIVE' ${wherefilter}
            GROUP BY og.district;`, { type: QueryTypes.SELECT });
                courseINcompleted = await db.query(`SELECT 
    district,COUNT(district) AS courseIN
FROM
    organizations AS og
        INNER JOIN
    (SELECT 
        organization_code, cou
    FROM
        mentors AS mn
    INNER JOIN (SELECT 
        user_id, COUNT(mentor_topic_progress_id) AS cou
    FROM
        mentor_topic_progress
    GROUP BY user_id
    HAVING cou < ${baseConfig.MENTOR_COURSE}) AS t ON mn.user_id = t.user_id) AS c ON c.organization_code = og.organization_code
WHERE
    og.status = 'ACTIVE' ${wherefilter}
GROUP BY og.district`, { type: QueryTypes.SELECT });
                courseCompleted = await db.query(`SELECT 
    district,COUNT(district) AS courseCMP
FROM
    organizations AS og
        INNER JOIN
    (SELECT 
        organization_code, cou
    FROM
        mentors AS mn
    INNER JOIN (SELECT 
        user_id, COUNT(mentor_topic_progress_id) AS cou
    FROM
        mentor_topic_progress
    GROUP BY user_id
    HAVING cou >= ${baseConfig.MENTOR_COURSE}) AS t ON mn.user_id = t.user_id) AS c ON c.organization_code = og.organization_code
WHERE
    og.status = 'ACTIVE' ${wherefilter}
GROUP BY og.district`, { type: QueryTypes.SELECT });
            } else {
                summary = await db.query(`SELECT 
                    og.state, COUNT(mn.mentor_id) AS totalReg
                FROM
                    organizations AS og
                        LEFT JOIN
                    mentors AS mn ON og.organization_code = mn.organization_code
                    WHERE og.status='ACTIVE'
                GROUP BY og.state ORDER BY og.state;`, { type: QueryTypes.SELECT });
                teamCount = await db.query(`SELECT 
                og.state, COUNT(t.team_id) AS totalTeams
            FROM
                organizations AS og
                    INNER JOIN
                mentors AS mn ON og.organization_code = mn.organization_code
                    INNER JOIN
                teams AS t ON mn.mentor_id = t.mentor_id
                WHERE og.status='ACTIVE'
            GROUP BY og.state;`, { type: QueryTypes.SELECT });
                studentCountDetails = await db.query(`SELECT 
                og.state,
                COUNT(st.student_id) AS totalstudent,
                SUM(CASE
                    WHEN st.gender = 'MALE' THEN 1
                    ELSE 0
                END) AS male,
                SUM(CASE
                    WHEN st.gender = 'FEMALE' THEN 1
                    ELSE 0
                END) AS female
            FROM
                organizations AS og
                    INNER JOIN
                mentors AS mn ON og.organization_code = mn.organization_code
                    INNER JOIN
                teams AS t ON mn.mentor_id = t.mentor_id
                    INNER JOIN
                students AS st ON st.team_id = t.team_id
                WHERE og.status='ACTIVE'
            GROUP BY og.state;`, { type: QueryTypes.SELECT });
                courseINcompleted = await db.query(`SELECT 
    state,COUNT(state) AS courseIN
FROM
    organizations AS og
        INNER JOIN
    (SELECT 
        organization_code, cou
    FROM
        mentors AS mn
    INNER JOIN (SELECT 
        user_id, COUNT(mentor_topic_progress_id) AS cou
    FROM
        mentor_topic_progress
    GROUP BY user_id
    HAVING cou < ${baseConfig.MENTOR_COURSE}) AS t ON mn.user_id = t.user_id) AS c ON c.organization_code = og.organization_code
WHERE
    og.status = 'ACTIVE'
GROUP BY og.state`, { type: QueryTypes.SELECT });
                courseCompleted = await db.query(`
                    SELECT 
    state,COUNT(state) AS courseCMP
FROM
    organizations AS og
        INNER JOIN
    (SELECT 
        organization_code, cou
    FROM
        mentors AS mn
    INNER JOIN (SELECT 
        user_id, COUNT(mentor_topic_progress_id) AS cou
    FROM
        mentor_topic_progress
    GROUP BY user_id
    HAVING cou >= ${baseConfig.MENTOR_COURSE}) AS t ON mn.user_id = t.user_id) AS c ON c.organization_code = og.organization_code
WHERE
    og.status = 'ACTIVE'
GROUP BY og.state
                    `, { type: QueryTypes.SELECT });
            }
            data['summary'] = summary;
            data['teamCount'] = teamCount;
            data['studentCountDetails'] = studentCountDetails;
            data['courseCompleted'] = courseCompleted;
            data['courseINcompleted'] = courseINcompleted;
            if (!data) {
                throw notFound(speeches.DATA_NOT_FOUND)
            }
            if (data instanceof Error) {
                throw data
            }
            res.status(200).send(dispatcher(res, data, "success"))
        } catch (err) {
            console.log(err)
            next(err)
        }
    }
    protected async getstudentDetailstable(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            let wherefilter = '';
            let summary
            let studentCountDetails
            let courseCompleted
            let courseINprogesss
            let submittedCount
            let draftCount
            if (state) {
                wherefilter = `&& og.state= '${state}'`;
                summary = await db.query(`SELECT 
                    og.district, COUNT(t.team_id) AS totalTeams
                FROM
                    organizations AS og
                        LEFT JOIN
                    mentors AS mn ON og.organization_code = mn.organization_code
                        LEFT JOIN
                    teams AS t ON mn.mentor_id = t.mentor_id
                    WHERE og.status='ACTIVE' ${wherefilter}
                GROUP BY og.district ORDER BY og.district;`, { type: QueryTypes.SELECT });
                studentCountDetails = await db.query(`SELECT 
                    og.district,
                    COUNT(st.student_id) AS totalstudent
                FROM
                    organizations AS og
                        LEFT JOIN
                    mentors AS mn ON og.organization_code = mn.organization_code
                        INNER JOIN
                    teams AS t ON mn.mentor_id = t.mentor_id
                        INNER JOIN
                    students AS st ON st.team_id = t.team_id where og.status = 'ACTIVE' ${wherefilter}
                GROUP BY og.district;`, { type: QueryTypes.SELECT });
                courseCompleted = await db.query(`SELECT 
                    og.district,count(st.student_id) as studentCourseCMP
                FROM
                    students AS st
                        JOIN
                    teams AS te ON st.team_id = te.team_id
                        JOIN
                    mentors AS mn ON te.mentor_id = mn.mentor_id
                        JOIN
                    organizations AS og ON mn.organization_code = og.organization_code
                        JOIN
                    (SELECT 
                        user_id, COUNT(*)
                    FROM
                        user_topic_progress
                    GROUP BY user_id
                    HAVING COUNT(*) >= ${baseConfig.STUDENT_COURSE}) AS temp ON st.user_id = temp.user_id WHERE og.status='ACTIVE' ${wherefilter} group by og.district`, { type: QueryTypes.SELECT });
                courseINprogesss = await db.query(`SELECT 
                    og.district,count(st.student_id) as studentCourseIN
                FROM
                    students AS st
                        JOIN
                    teams AS te ON st.team_id = te.team_id
                        JOIN
                    mentors AS mn ON te.mentor_id = mn.mentor_id
                        JOIN
                    organizations AS og ON mn.organization_code = og.organization_code
                        JOIN
                    (SELECT 
                        user_id, COUNT(*)
                    FROM
                        user_topic_progress
                    GROUP BY user_id
                    HAVING COUNT(*) < ${baseConfig.STUDENT_COURSE}) AS temp ON st.user_id = temp.user_id WHERE og.status='ACTIVE' ${wherefilter} group by og.district`, { type: QueryTypes.SELECT });
                submittedCount = await db.query(`SELECT 
                    og.district,count(te.team_id) as submittedCount
                FROM
                    teams AS te
                        JOIN
                    mentors AS mn ON te.mentor_id = mn.mentor_id
                        JOIN
                    organizations AS og ON mn.organization_code = og.organization_code
                        JOIN
                    (SELECT 
                        team_id, status
                    FROM
                        challenge_responses
                    WHERE
                        status = 'SUBMITTED') AS temp ON te.team_id = temp.team_id WHERE og.status='ACTIVE' ${wherefilter} group by og.district`, { type: QueryTypes.SELECT });
                draftCount = await db.query(`SELECT 
                    og.district,count(te.team_id) as draftCount
                FROM
                    teams AS te
                        JOIN
                    mentors AS mn ON te.mentor_id = mn.mentor_id
                        JOIN
                    organizations AS og ON mn.organization_code = og.organization_code
                        JOIN
                    (SELECT 
                        team_id, status
                    FROM
                        challenge_responses
                    WHERE
                        status = 'DRAFT') AS temp ON te.team_id = temp.team_id WHERE og.status='ACTIVE' ${wherefilter} group by og.district`, { type: QueryTypes.SELECT });
            } else {
                summary = await db.query(`SELECT 
                    og.state, COUNT(t.team_id) AS totalTeams
                FROM
                    organizations AS og
                        LEFT JOIN
                    mentors AS mn ON og.organization_code = mn.organization_code
                        LEFT JOIN
                    teams AS t ON mn.mentor_id = t.mentor_id
                    WHERE og.status='ACTIVE'
                GROUP BY og.state ORDER BY og.state;`, { type: QueryTypes.SELECT });
                studentCountDetails = await db.query(`SELECT 
                    og.state,
                    COUNT(st.student_id) AS totalstudent
                FROM
                    organizations AS og
                        LEFT JOIN
                    mentors AS mn ON og.organization_code = mn.organization_code
                        INNER JOIN
                    teams AS t ON mn.mentor_id = t.mentor_id
                        INNER JOIN
                    students AS st ON st.team_id = t.team_id where og.status = 'ACTIVE'
                GROUP BY og.state;`, { type: QueryTypes.SELECT });
                courseCompleted = await db.query(`SELECT 
                    og.state,count(st.student_id) as studentCourseCMP
                FROM
                    students AS st
                        JOIN
                    teams AS te ON st.team_id = te.team_id
                        JOIN
                    mentors AS mn ON te.mentor_id = mn.mentor_id
                        JOIN
                    organizations AS og ON mn.organization_code = og.organization_code
                        JOIN
                    (SELECT 
                        user_id, COUNT(*)
                    FROM
                        user_topic_progress
                    GROUP BY user_id
                    HAVING COUNT(*) >= ${baseConfig.STUDENT_COURSE}) AS temp ON st.user_id = temp.user_id WHERE og.status='ACTIVE' group by og.state`, { type: QueryTypes.SELECT });
                courseINprogesss = await db.query(`SELECT 
                    og.state,count(st.student_id) as studentCourseIN
                FROM
                    students AS st
                        JOIN
                    teams AS te ON st.team_id = te.team_id
                        JOIN
                    mentors AS mn ON te.mentor_id = mn.mentor_id
                        JOIN
                    organizations AS og ON mn.organization_code = og.organization_code
                        JOIN
                    (SELECT 
                        user_id, COUNT(*)
                    FROM
                        user_topic_progress
                    GROUP BY user_id
                    HAVING COUNT(*) < ${baseConfig.STUDENT_COURSE}) AS temp ON st.user_id = temp.user_id WHERE og.status='ACTIVE' group by og.state`, { type: QueryTypes.SELECT });
                submittedCount = await db.query(`SELECT 
                    og.state,count(te.team_id) as submittedCount
                FROM
                    teams AS te
                        JOIN
                    mentors AS mn ON te.mentor_id = mn.mentor_id
                        JOIN
                    organizations AS og ON mn.organization_code = og.organization_code
                        JOIN
                    (SELECT 
                        team_id, status
                    FROM
                        challenge_responses
                    WHERE
                        status = 'SUBMITTED') AS temp ON te.team_id = temp.team_id WHERE og.status='ACTIVE' group by og.state`, { type: QueryTypes.SELECT });
                draftCount = await db.query(`SELECT 
                    og.state,count(te.team_id) as draftCount
                FROM
                    teams AS te
                        JOIN
                    mentors AS mn ON te.mentor_id = mn.mentor_id
                        JOIN
                    organizations AS og ON mn.organization_code = og.organization_code
                        JOIN
                    (SELECT 
                        team_id, status
                    FROM
                        challenge_responses
                    WHERE
                        status = 'DRAFT') AS temp ON te.team_id = temp.team_id WHERE og.status='ACTIVE' group by og.state`, { type: QueryTypes.SELECT });
            }
            data['summary'] = summary;
            data['studentCountDetails'] = studentCountDetails;
            data['courseCompleted'] = courseCompleted;
            data['courseINprogesss'] = courseINprogesss;
            data['submittedCount'] = submittedCount;
            data['draftCount'] = draftCount;
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
    protected async getmentorDetailsreport(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            const { category, district, state } = newREQQuery;
            let districtFilter: any = `'%%'`
            let categoryFilter: any = `'%%'`
            let stateFilter: any = `'%%'`
            if (district !== 'All Districts' && district !== undefined) {
                districtFilter = `'${district}'`
            }
            if (category !== 'All Categories' && category !== undefined) {
                categoryFilter = `'${category}'`
            }
            if (state !== 'All States' && state !== undefined) {
                stateFilter = `'${state}'`
            }
            const summary = await db.query(`SELECT 
    mn.mentor_id,
    mn.user_id,
    og.organization_code,
    og.organization_name,
    og.district,
    og.category,
    og.city,
    og.principal_name,
    og.principal_mobile,
    mn.full_name,
    mn.gender,
    mn.mobile,
    mn.whatapp_mobile,
    og.state,
    og.unique_code
FROM
    (mentors AS mn)
        LEFT JOIN
    organizations AS og ON mn.organization_code = og.organization_code
WHERE
    og.status = 'ACTIVE' && og.state LIKE ${stateFilter} && og.district LIKE ${districtFilter} && og.category LIKE ${categoryFilter}
            ORDER BY og.district,mn.full_name;`, { type: QueryTypes.SELECT });
            const preSurvey = await db.query(`SELECT 
        CASE
            WHEN status = 'ACTIVE' THEN 'Completed'
        END AS 'pre_survey_status',
        user_id
    FROM
        quiz_survey_responses
    WHERE
        quiz_survey_id = 1`, { type: QueryTypes.SELECT });
            const postSurvey = await db.query(`SELECT 
    CASE
        WHEN status = 'ACTIVE' THEN 'Completed'
    END AS 'post_survey_status',
    user_id
FROM
    quiz_survey_responses
WHERE
    quiz_survey_id = 3`, { type: QueryTypes.SELECT });
            const Course = await db.query(`SELECT 
    CASE
        WHEN COUNT(mentor_course_topic_id) >= ${baseConfig.MENTOR_COURSE} THEN 'Completed'
        ELSE 'In Progress'
    END AS 'course_status',
    user_id
FROM
    mentor_topic_progress
GROUP BY user_id`, { type: QueryTypes.SELECT });
            const teamCount = await db.query(`SELECT 
    COUNT(*) AS team_count, mentor_id
FROM
    teams
GROUP BY mentor_id`, { type: QueryTypes.SELECT });
            const studentCount = await db.query(`SELECT 
    COUNT(*) AS student_count, mentor_id
FROM
    teams
        JOIN
    students ON teams.team_id = students.team_id
GROUP BY mentor_id`, { type: QueryTypes.SELECT });
            const StudentCourseCmp = await db.query(`SELECT 
    COUNT(*) AS countop, mentor_id
FROM
    (SELECT 
        mentor_id, student_id, COUNT(*), students.user_id
    FROM
        teams
    LEFT JOIN students ON teams.team_id = students.team_id
    JOIN user_topic_progress ON students.user_id = user_topic_progress.user_id
    GROUP BY student_id
    HAVING COUNT(*) >= ${baseConfig.STUDENT_COURSE}) AS total
GROUP BY mentor_id`, { type: QueryTypes.SELECT });
            const StudentCourseINpro = await db.query(`SELECT 
    COUNT(*) AS courseinprogess, mentor_id
FROM
    (SELECT 
        mentor_id, student_id, COUNT(*), students.user_id
    FROM
        teams
    LEFT JOIN students ON teams.team_id = students.team_id
    JOIN user_topic_progress ON students.user_id = user_topic_progress.user_id
    GROUP BY student_id
    HAVING COUNT(*) < ${baseConfig.STUDENT_COURSE}) AS total
GROUP BY mentor_id`, { type: QueryTypes.SELECT });
            const StuIdeaSubCount = await db.query(`SELECT 
    COUNT(*) AS submittedcout, mentor_id
FROM
    teams
        JOIN
    challenge_responses ON teams.team_id = challenge_responses.team_id
WHERE
    challenge_responses.status = 'SUBMITTED'
GROUP BY mentor_id`, { type: QueryTypes.SELECT });
            const StuIdeaDraftCount = await db.query(`SELECT 
    COUNT(*) AS draftcout, mentor_id
FROM
    teams
        JOIN
    challenge_responses ON teams.team_id = challenge_responses.team_id
WHERE
    challenge_responses.status = 'DRAFT'
GROUP BY mentor_id`, { type: QueryTypes.SELECT });
            const Username = await db.query(`SELECT 
    user_id, username
FROM
    users
WHERE
    role = 'MENTOR'`, { type: QueryTypes.SELECT });
            const studentpresurvey = await db.query(`SELECT 
    COUNT(*) AS preSur_cmp, mentor_id
FROM
    teams
        JOIN
    students ON teams.team_id = students.team_id
        JOIN
    quiz_survey_responses ON students.user_id = quiz_survey_responses.user_id
        AND quiz_survey_id = 2
GROUP BY mentor_id
`, { type: QueryTypes.SELECT });
            const studentpostsurvey = await db.query(`SELECT 
    COUNT(*) AS preSur_cmp, mentor_id
FROM
    teams
        JOIN
    students ON teams.team_id = students.team_id
        JOIN
    quiz_survey_responses ON students.user_id = quiz_survey_responses.user_id
        AND quiz_survey_id = 4
GROUP BY mentor_id
`, { type: QueryTypes.SELECT });
            data['summary'] = summary;
            data['preSurvey'] = preSurvey;
            data['postSurvey'] = postSurvey;
            data['Course'] = Course;
            data['teamCount'] = teamCount;
            data['studentpresurvey'] = studentpresurvey;
            data['studentpostsurvey'] = studentpostsurvey;
            data['studentCount'] = studentCount;
            data['StudentCourseCmp'] = StudentCourseCmp;
            data['StudentCourseINpro'] = StudentCourseINpro;
            data['StuIdeaSubCount'] = StuIdeaSubCount;
            data['StuIdeaDraftCount'] = StuIdeaDraftCount;
            data['Username'] = Username;
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
    protected async getstudentDetailsreport(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            const { category, district, state } = newREQQuery;
            let districtFilter: any = `'%%'`
            let categoryFilter: any = `'%%'`
            let stateFilter: any = `'%%'`
            if (district !== 'All Districts' && district !== undefined) {
                districtFilter = `'${district}'`
            }
            if (category !== 'All Categories' && category !== undefined) {
                categoryFilter = `'${category}'`
            }
            if (state !== 'All States' && state !== undefined) {
                stateFilter = `'${state}'`
            }
            const summary = await db.query(`SELECT 
    student_id,
    students.full_name as studentfullname,
    Age,
    students.gender as studentgender,
    students.Grade,
    students.team_id,
    students.user_id,
    disability
FROM
    students
        JOIN
    teams ON students.team_id = teams.team_id
        JOIN
    mentors ON teams.mentor_id = mentors.mentor_id
        JOIN
    organizations AS og ON mentors.organization_code = og.organization_code
WHERE
    og.status = 'ACTIVE' && og.state LIKE ${stateFilter} && og.district LIKE ${districtFilter} && og.category LIKE ${categoryFilter} order by og.district`, { type: QueryTypes.SELECT });
            const teamData = await db.query(`SELECT 
    team_id, team_name,team_email, mentor_id,user_id as teamuserId
FROM
    teams`, { type: QueryTypes.SELECT });
            const mentorData = await db.query(`SELECT 
    mn.mentor_id,
    mn.user_id as mentorUserId,
    og.organization_code,
    og.organization_name,
    og.district,
    og.category,
    og.city,
    og.principal_name,
    og.principal_mobile,
    mn.full_name,
    mn.gender,
    mn.mobile,
    mn.whatapp_mobile,
    og.state,
    og.unique_code
FROM
    (mentors AS mn)
        LEFT JOIN
    organizations AS og ON mn.organization_code = og.organization_code
WHERE
    og.status = 'ACTIVE';`, { type: QueryTypes.SELECT });
            const mentorUsername = await db.query(`SELECT 
               user_id, username
           FROM
               users
           WHERE
               role = 'MENTOR'`, { type: QueryTypes.SELECT });
            const teamUsername = await db.query(`SELECT 
                user_id as teamuserId, username as teamUsername
            FROM
                users
            WHERE
                role = 'TEAM'`, { type: QueryTypes.SELECT });
            const preSurvey = await db.query(`SELECT 
                CASE
                    WHEN status = 'ACTIVE' THEN 'Completed'
                END AS 'pre_survey_status',
                user_id
            FROM
                quiz_survey_responses
            WHERE
                quiz_survey_id = 2`, { type: QueryTypes.SELECT });
            const postSurvey = await db.query(`SELECT 
    CASE
        WHEN status = 'ACTIVE' THEN 'Completed'
    END AS 'post_survey_status',
    user_id
FROM
    quiz_survey_responses
WHERE
    quiz_survey_id = 4`, { type: QueryTypes.SELECT });
            const ideaStatusData = await db.query(`SELECT 
    team_id, status
FROM
    challenge_responses`, { type: QueryTypes.SELECT });
            const userTopicData = await db.query(`SELECT 
    COUNT(*) AS user_count, user_id
FROM
    user_topic_progress
GROUP BY user_id`, { type: QueryTypes.SELECT });

            data['summary'] = summary;
            data['teamData'] = teamData;
            data['teamUsername'] = teamUsername;
            data['mentorData'] = mentorData;
            data['mentorUsername'] = mentorUsername;
            data['preSurvey'] = preSurvey;
            data['postSurvey'] = postSurvey;
            data['ideaStatusData'] = ideaStatusData;
            data['userTopicData'] = userTopicData;

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
    protected async getstudentATLnonATLcount(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            let wherefilter = '';
            let summary
            if (state) {
                wherefilter = `WHERE org.state= '${state}'`;
                summary = await db.query(`SELECT 
                    org.district, COALESCE(ATL_Student_Count, 0) as ATL_Student_Count, COALESCE(NONATL_Student_Count, 0) as NONATL_Student_Count
                FROM
                    organizations AS org
                       left JOIN
                    (SELECT 
                        o.district,
                            COUNT(CASE
                                WHEN o.category = 'ATL' THEN 1
                            END) AS ATL_Student_Count,
                            COUNT(CASE
                                WHEN o.category = 'Non ATL' THEN 1
                            END) AS NONATL_Student_Count
                    FROM
                        students AS s
                    JOIN teams AS t ON s.team_id = t.team_id
                    JOIN mentors AS m ON t.mentor_id = m.mentor_id
                    JOIN organizations AS o ON m.organization_code = o.organization_code
                    WHERE
                        o.status = 'ACTIVE'
                    GROUP BY o.district) AS t2 ON org.district = t2.district
                    ${wherefilter}
                GROUP BY org.district;`, { type: QueryTypes.SELECT });
            } else {
                summary = await db.query(`SELECT 
                    org.state, COALESCE(ATL_Student_Count, 0) as ATL_Student_Count, COALESCE(NONATL_Student_Count, 0) as NONATL_Student_Count
                FROM
                    organizations AS org
                       left JOIN
                    (SELECT 
                        o.state,
                            COUNT(CASE
                                WHEN o.category = 'ATL' THEN 1
                            END) AS ATL_Student_Count,
                            COUNT(CASE
                                WHEN o.category = 'Non ATL' THEN 1
                            END) AS NONATL_Student_Count
                    FROM
                        students AS s
                    JOIN teams AS t ON s.team_id = t.team_id
                    JOIN mentors AS m ON t.mentor_id = m.mentor_id
                    JOIN organizations AS o ON m.organization_code = o.organization_code
                    WHERE
                        o.status = 'ACTIVE'
                    GROUP BY o.state) AS t2 ON org.state = t2.state
                GROUP BY org.state;`, { type: QueryTypes.SELECT });
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
    protected async getideaReport(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            const { state, district, theme, category } = newREQQuery;
            let districtFilter: any = `'%%'`
            let categoryFilter: any = `'%%'`
            let stateFilter: any = `'%%'`
            let themesFilter: any = `'%%'`
            if (district !== 'All Districts' && district !== undefined) {
                districtFilter = `'${district}'`
            }
            if (category !== 'All Categories' && category !== undefined) {
                categoryFilter = `'${category}'`
            }
            if (state !== 'All States' && state !== undefined) {
                stateFilter = `'${state}'`
            }
            if (theme !== 'All Themes' && theme !== undefined) {
                themesFilter = `'${theme}'`
            }
            const summary = await db.query(`SELECT 
    challenge_response_id,
    cr.team_id,
    cr.status,
    theme,
    focus_area,
    cr.title,
    problem_statement,
    causes,
    effects,
    community,
    facing,
    solution,
    stakeholders,
    problem_solving,
    feedback,
    prototype_image,
    prototype_link,
    workbook,
    language,
    verified_status,
    verified_at,
    mentor_rejected_reason
FROM
    challenge_responses as cr join teams as t on cr.team_id = t.team_id join mentors as m on t.mentor_id = m.mentor_id join organizations as org on m.organization_code = org.organization_code
WHERE
   org.status = 'ACTIVE' && cr.status = 'SUBMITTED' && org.state LIKE ${stateFilter} && org.district LIKE ${districtFilter} && org.category LIKE ${categoryFilter} && cr.theme LIKE ${themesFilter};`, { type: QueryTypes.SELECT });
            const teamData = await db.query(`SELECT 
    team_id, team_name,team_email, mentor_id,user_id as teamuserId
FROM
    teams`, { type: QueryTypes.SELECT });
            const mentorData = await db.query(`SELECT 
        mn.mentor_id,
        mn.user_id as mentorUserId,
        og.organization_code,
        og.organization_name,
        og.district,
        og.category,
        og.pin_code,
        og.address,
        mn.full_name,
        mn.mobile,
        og.state,
        mn.gender,
        og.unique_code
    FROM
        (mentors AS mn)
            LEFT JOIN
        organizations AS og ON mn.organization_code = og.organization_code
    WHERE
        og.status = 'ACTIVE';`, { type: QueryTypes.SELECT });
            const mentorUsername = await db.query(`SELECT 
                   user_id, username
               FROM
                   users
               WHERE
                   role = 'MENTOR'`, { type: QueryTypes.SELECT });
            const teamUsername = await db.query(`SELECT 
                    user_id as teamuserId, username as teamUsername
                FROM
                    users
                WHERE
                    role = 'TEAM'`, { type: QueryTypes.SELECT });
            const student_names = await db.query(`SELECT 
          GROUP_CONCAT(full_name
                  SEPARATOR ', ') AS names,
              team_id
      FROM
          students
      GROUP BY team_id`, { type: QueryTypes.SELECT });
            data['summary'] = summary;
            data['teamData'] = teamData;
            data['teamUsername'] = teamUsername;
            data['mentorData'] = mentorData;
            data['mentorUsername'] = mentorUsername;
            data['student_names'] = student_names;

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
    protected async getideaReportTable(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            let wherefilter = '';
            let summary
            if (state) {
                wherefilter = `WHERE org.state= '${state}'`;
                summary = await db.query(`SELECT 
                    org.district,
                    COALESCE(totalSubmited, 0) AS totalSubmited,
                    COALESCE(SustainableDevelopmentandEnvironment, 0) AS SustainableDevelopmentandEnvironment,
                    COALESCE(DigitalTransformation, 0) AS DigitalTransformation,
                    COALESCE(HealthandWellbeing, 0) AS HealthandWellbeing,
                    COALESCE(QualityEducation, 0) AS QualityEducation,
                    COALESCE(EconomicEmpowerment, 0) AS EconomicEmpowerment,
                    COALESCE(SmartandResilientCommunities, 0) AS SmartandResilientCommunities,
                    COALESCE(AgricultureandRuralDevelopment, 0) AS AgricultureandRuralDevelopment,
                    COALESCE(OTHERS, 0) AS OTHERS
                FROM
                    organizations AS org
                        LEFT JOIN
                    (SELECT 
                        COUNT(*) AS totalSubmited,
                            COUNT(CASE
                                WHEN cal.theme = 'Sustainable Development and Environment' THEN 1
                            END) AS SustainableDevelopmentandEnvironment,
                            COUNT(CASE
                                WHEN cal.theme = 'Digital Transformation' THEN 1
                            END) AS DigitalTransformation,
                            COUNT(CASE
                                WHEN cal.theme = 'Health and Well-being' THEN 1
                            END) AS HealthandWellbeing,
                            COUNT(CASE
                                WHEN cal.theme = 'Quality Education' THEN 1
                            END) AS QualityEducation,
                            COUNT(CASE
                                WHEN cal.theme = 'Economic Empowerment' THEN 1
                            END) AS EconomicEmpowerment,
                            COUNT(CASE
                                WHEN cal.theme = 'Smart and Resilient Communities' THEN 1
                            END) AS SmartandResilientCommunities,
                            COUNT(CASE
                                WHEN cal.theme = 'Agriculture and Rural Development' THEN 1
                            END) AS AgricultureandRuralDevelopment,
                            COUNT(CASE
                                WHEN cal.theme = 'Others' THEN 1
                            END) AS OTHERS,
                            org.district
                    FROM
                        challenge_responses AS cal
                    JOIN teams AS t ON cal.team_id = t.team_id
                    JOIN mentors AS m ON t.mentor_id = m.mentor_id
                    JOIN organizations AS org ON m.organization_code = org.organization_code
                    WHERE
                        cal.status = 'SUBMITTED'
                    GROUP BY org.district) AS t2 ON org.district = t2.district
                    ${wherefilter}
                GROUP BY org.district ORDER BY org.district`, { type: QueryTypes.SELECT });
            } else {
                summary = await db.query(`SELECT 
                    org.state,
                    COALESCE(totalSubmited, 0) AS totalSubmited,
                    COALESCE(SustainableDevelopmentandEnvironment, 0) AS SustainableDevelopmentandEnvironment,
                    COALESCE(DigitalTransformation, 0) AS DigitalTransformation,
                    COALESCE(HealthandWellbeing, 0) AS HealthandWellbeing,
                    COALESCE(QualityEducation, 0) AS QualityEducation,
                    COALESCE(EconomicEmpowerment, 0) AS EconomicEmpowerment,
                    COALESCE(SmartandResilientCommunities, 0) AS SmartandResilientCommunities,
                    COALESCE(AgricultureandRuralDevelopment, 0) AS AgricultureandRuralDevelopment,
                    COALESCE(OTHERS, 0) AS OTHERS
                FROM
                    organizations AS org
                        LEFT JOIN
                    (SELECT 
                        COUNT(*) AS totalSubmited,
                            COUNT(CASE
                                WHEN cal.theme = 'Sustainable Development and Environment' THEN 1
                            END) AS SustainableDevelopmentandEnvironment,
                            COUNT(CASE
                                WHEN cal.theme = 'Digital Transformation' THEN 1
                            END) AS DigitalTransformation,
                            COUNT(CASE
                                WHEN cal.theme = 'Health and Well-being' THEN 1
                            END) AS HealthandWellbeing,
                            COUNT(CASE
                                WHEN cal.theme = 'Quality Education' THEN 1
                            END) AS QualityEducation,
                            COUNT(CASE
                                WHEN cal.theme = 'Economic Empowerment' THEN 1
                            END) AS EconomicEmpowerment,
                            COUNT(CASE
                                WHEN cal.theme = 'Smart and Resilient Communities' THEN 1
                            END) AS SmartandResilientCommunities,
                            COUNT(CASE
                                WHEN cal.theme = 'Agriculture and Rural Development' THEN 1
                            END) AS AgricultureandRuralDevelopment,
                            COUNT(CASE
                                WHEN cal.theme = 'Others' THEN 1
                            END) AS OTHERS,
                            org.state
                    FROM
                        challenge_responses AS cal
                    JOIN teams AS t ON cal.team_id = t.team_id
                    JOIN mentors AS m ON t.mentor_id = m.mentor_id
                    JOIN organizations AS org ON m.organization_code = org.organization_code
                    WHERE
                        cal.status = 'SUBMITTED'
                    GROUP BY org.state) AS t2 ON org.state = t2.state
                GROUP BY org.state ORDER BY org.state`, { type: QueryTypes.SELECT });
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
    protected async getSchoolList(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'REPORT' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let data: any;

            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const { state, district, theme, category } = newREQQuery;
            const where: any = {
                status: 'ACTIVE',
            };
            if (district !== 'All Districts' && district !== undefined) {
                where['district'] = district
            }
            if (category !== 'All Categories' && category !== undefined) {
                where['category'] = category
            }
            if (state !== 'All States' && state !== undefined) {
                where['state'] = state
            }
            try {
                data = await this.crudService.findAll(organization,{
                    attributes: [
                      "organization_name",
                      "organization_code",
                      "city",
                      "district",
                      "category",
                      "state",
                      "country",
                      "address",
                      "pin_code",
                      "principal_name",
                      "principal_mobile",
                      "principal_email",
                      [db.fn('COUNT', db.col('mentor.mentor_id')), 'mentor_reg']
                    ],
                    include: [{
                      model: mentor,  // Assuming 'Mentors' is the related model
                      attributes: [],  // No need to fetch mentor data, just count
                      required: false  // LEFT JOIN to include organizations with no mentors
                    }],
                    where,
                    group: ['organization.organization_code']
                  });
                  
            } catch (error: any) {
                console.log(error)
                next(error)
            }
            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            console.log(error)
            next(error);
        }
    }
    protected async getschoolcategorylist(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'REPORT' && res.locals.role !== 'STATE') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            let result: any = {}
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            const state = newREQQuery.state;
            if (state) {
                const categorydata = await db.query(`SELECT DISTINCT
                    category
                        FROM
                    organizations
                    WHERE
                state = '${state}'`, { type: QueryTypes.SELECT });
                const querystring: any = await this.authService.combineCategorylistState(categorydata);

                const data = await db.query(`SELECT district,count(mentor_id) as reg_school,
                    ${querystring.replace(/,$/, '')}
                    FROM
                organizations as o LEFT JOIN
    (SELECT 
        mentor_id,organization_code
    FROM
        mentors
    GROUP BY organization_code) AS m ON o.organization_code = m.organization_code where state = '${state}' group by district`, { type: QueryTypes.SELECT });
                result = await this.authService.totalofCategorylistState(data);
            }

            if (!result) {
                throw notFound(speeches.DATA_NOT_FOUND)
            }
            if (result instanceof Error) {
                throw result
            }
            res.status(200).send(dispatcher(res, result, "success"))
        } catch (err) {
            next(err)
        }
    }
}
