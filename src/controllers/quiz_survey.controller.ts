

import { badData, badRequest, internal, notFound, unauthorized } from "boom";
import { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import { constents } from "../configs/constents.config";
import { speeches } from "../configs/speeches.config";
import validationMiddleware from "../middlewares/validation.middleware";
import { quiz_survey_question } from "../models/quiz_survey_question.model";
import { quiz_survey_response } from "../models/quiz_survey_response.model";
import dispatcher from "../utils/dispatch.util";
import { quizSchema, quizSubmitResponsesSchema, quizUpdateSchema } from "../validations/quiz_survey.validations";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import db from "../utils/dbconnection.util";
import authService from '../services/auth.service';
export default class QuizSurveyController extends BaseController {

    model = "quiz_survey";
    authService: authService = new authService;
    protected initializePath(): void {
        this.path = '/quizSurveys';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(quizSchema, quizUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.post(this.path + "/:id/responses/", validationMiddleware(quizSubmitResponsesSchema), this.submitResponses.bind(this));
        super.initializeRoutes();
    }
    protected async getData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR') {
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
            let user_id = newREQQuery.user_id;
            if (!user_id) {
                throw unauthorized(speeches.UNAUTHORIZED_ACCESS)
            }
            let role: any = newREQQuery.role;

            if (role && !Object.keys(constents.user_role_flags.list).includes(role)) {
                role = "MENTOR"
            }
            let data: any;
            const { model, id } = req.params;
            const paramStatus: any = newREQQuery.status;
            if (model) {
                this.model = model;
            };
            // pagination
            const { page, size, title } = newREQQuery;
            let condition: any = {};
            if (title) {
                condition.title = { [Op.like]: `%${title}%` }
            }
            if (role) {
                condition.role = role;
            }
            const { limit, offset } = this.getPagination(page, size);
            const modelClass = await this.loadModel(model).catch(error => {
                next(error)
            });
            const where: any = {};
            let whereClauseStatusPart: any = {};
            let whereClauseStatusPartLiteral = "1=1";
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
            if (id) {
                const newParamId: any = await this.authService.decryptGlobal(req.params.id);
                where[`${this.model}_id`] = JSON.parse(newParamId);
                data = await this.crudService.findOne(modelClass, {
                    attributes: [
                        "quiz_survey_id",
                        "no_of_questions",
                        "role",
                        "name",
                        "description",
                        [
                            // Note the wrapping parentheses in the call below!
                            db.literal(`(
                                SELECT CASE WHEN EXISTS 
                                    (SELECT status 
                                    FROM quiz_survey_responses as p 
                                    WHERE p.user_id = ${user_id} 
                                    AND p.quiz_survey_id = \`quiz_survey\`.\`quiz_survey_id\`) 
                                THEN  
                                    "COMPLETED"
                                ELSE 
                                    '${constents.task_status_flags.default}'
                                END as progress
                            )`),
                            'progress'
                        ],
                    ],
                    where: {
                        [Op.and]: [
                            whereClauseStatusPart,
                            where,
                            condition
                        ]
                    },

                    include: {
                        required: false,
                        model: quiz_survey_question,
                    }
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
                            "quiz_survey_id",
                            "no_of_questions",
                            "role",
                            "name",
                            "description",
                            [
                                // Note the wrapping parentheses in the call below!
                                db.literal(`(
                                    SELECT CASE WHEN EXISTS 
                                        (SELECT status 
                                        FROM quiz_survey_responses as p 
                                        WHERE p.user_id = ${user_id} 
                                        AND p.quiz_survey_id = \`quiz_survey\`.\`quiz_survey_id\`) 
                                    THEN  
                                        "COMPLETED"
                                    ELSE 
                                        '${constents.task_status_flags.default}'
                                    END as progress
                                )`),
                                'progress'
                            ]
                        ],
                        include: {
                            required: false,
                            model: quiz_survey_question,
                        }, limit, offset
                    })
                    const result = this.getPagingData(responseOfFindAndCountAll, page, limit);
                    data = result;
                } catch (error: any) {
                    console.log(error)
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
                res.status(200).send(dispatcher(res, null, "error", speeches.DATA_NOT_FOUND));
                // if(data!=null){
                //     throw 
                (data.message)
                // }else{
                //     throw notFound()
                // }
            }

            //remove unneccesary data 
            //if  survey is completed then dont send back the questions ...!!!

            if (data && data.dataValues && data.dataValues.length > 0) {
                data.dataValues = data.dataValues.map(((quizSurvey: any) => {
                    if (quizSurvey && quizSurvey.dataValues && quizSurvey.dataValues.progress) {
                        if (quizSurvey.dataValues.progress == "COMPLETED") {
                            delete quizSurvey.dataValues.quiz_survey_questions
                        }
                    }
                    // console.log(quizSurvey.dataValues)
                    return quizSurvey;
                }))
            } else if (data && data.dataValues) {
                if (data && data.dataValues && data.dataValues.progress) {
                    if (data.dataValues.progress == "COMPLETED") {
                        delete data.dataValues.quiz_survey_questions
                    }
                }
            }

            return res.status(200).send(dispatcher(res, data, 'success'));
        } catch (error) {
            console.log(error)
            next(error);
        }
    }
    protected async insertSingleResponse(user_id: any, quiz_survey_id: any, quiz_survey_question_id: any, selected_option: any) {
        try {
            const questionAnswered = await this.crudService.findOne(quiz_survey_question, { where: { quiz_survey_question_id: quiz_survey_question_id } });
            if (questionAnswered instanceof Error) {
                throw internal(questionAnswered.message)
            }
            if (!questionAnswered) {
                throw badData("Invalid Quiz question id")
            }


            const quizRes = await this.crudService.findOne(quiz_survey_response, { where: { quiz_survey_id: quiz_survey_id, user_id: user_id } });
            if (quizRes instanceof Error) {
                throw internal(quizRes.message)
            }
            // console.log(quizRes);
            let dataToUpsert: any = {}
            dataToUpsert = { quiz_survey_id: quiz_survey_id, user_id: user_id, updated_by: user_id }

            let responseObjToAdd: any = {}
            responseObjToAdd = {
                quiz_survey_id: quiz_survey_id,
                selected_option: selected_option,
                question: questionAnswered.dataValues.question,
                // correct_answer:questionAnswered.dataValues.correct_ans,//there is no correct_ans collumn
                // level:questionAnswered.dataValues.level,//there are no level collumn
                question_no: questionAnswered.dataValues.question_no,
                // is_correct:selected_option==questionAnswered.correct_ans//there is no correct_ans collumn
            }

            let user_response: any = {}
            if (quizRes) {
                // console.log(quizRes.dataValues.response);
                user_response = JSON.parse(quizRes.dataValues.response);
                user_response[questionAnswered.dataValues.question_no] = responseObjToAdd;

                dataToUpsert["response"] = JSON.stringify(user_response);

                const resultModel = await this.crudService.update(quizRes, dataToUpsert, { where: { quiz_survey_id: quiz_survey_id, user_id: user_id } })
                if (resultModel instanceof Error) {
                    throw internal(resultModel.message)
                }
                let result: any = {}
                result = resultModel.dataValues
                // result["is_correct"] = responseObjToAdd.is_correct;
                // if(responseObjToAdd.is_correct){
                //     result["msg"] = questionAnswered.dataValues.msg_ans_correct;
                // }else{
                //     result["msg"] = questionAnswered.dataValues.msg_ans_wrong;
                // }
                // result["redirect_to"] = questionAnswered.dataValues.redirect_to;
                return result;
            } else {

                user_response[questionAnswered.dataValues.question_no] = responseObjToAdd;

                dataToUpsert["response"] = JSON.stringify(user_response);
                dataToUpsert = { ...dataToUpsert, created_by: user_id }

                const resultModel = await this.crudService.create(quiz_survey_response, dataToUpsert)
                if (resultModel instanceof Error) {
                    throw internal(resultModel.message)
                }
                let result: any = {}
                result = resultModel.dataValues
                // result["is_correct"] = responseObjToAdd.is_correct;
                // if(responseObjToAdd.is_correct){
                //     result["msg"] = questionAnswered.dataValues.msg_ans_correct;
                // }else{
                //     result["msg"] = questionAnswered.dataValues.msg_ans_wrong;
                // }
                // result["redirect_to"] = questionAnswered.dataValues.redirect_to;
                return result;
            }

        } catch (err) {
            return err;
        }

    }
    protected async submitResponses(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR') {
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
            const quiz_survey_id = await this.authService.decryptGlobal(req.params.id);
            const { responses } = req.body;
            const user_id = newREQQuery.user_id;
            if (!quiz_survey_id) {
                throw badRequest(speeches.QUIZ_ID_REQUIRED);
            }
            if (!responses) {
                throw badRequest(speeches.QUIZ_QUESTION_ID_REQUIRED);
            }

            if (!user_id) {
                throw unauthorized(speeches.UNAUTHORIZED_ACCESS);
            }
            const results: any = []
            let result: any = {}
            for (const element of responses) {
                // console.log(element);
                result = await this.insertSingleResponse(user_id, quiz_survey_id, element.quiz_survey_question_id, element.selected_option)
                if (!result || result instanceof Error) {
                    throw badRequest();
                } else {
                    results.push(result);
                }
            }
            res.status(200).send(dispatcher(res, result))

        } catch (err) {
            next(err)
        }
    }
} 
