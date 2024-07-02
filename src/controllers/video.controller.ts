import { notFound, unauthorized } from "boom";
import { Request, Response, NextFunction } from "express";
import { Op } from "sequelize";
import { constents } from "../configs/constents.config";
import { speeches } from "../configs/speeches.config";
import { reflective_quiz_question } from "../models/reflective_quiz_question.model";
import ReflectiveQuizService from "../services/reflective_quiz_.service";
import dispatcher from "../utils/dispatch.util";
import ValidationsHolder from "../validations/validationHolder";
import { videoSchema, videoUpdateSchema } from "../validations/video.validations";
import BaseController from "./base.controller";

export default class VideoController extends BaseController {
    reflectiveQuizService: ReflectiveQuizService = new ReflectiveQuizService
    model = "video";

    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(videoSchema, videoUpdateSchema);
    }
    protected initializePath(): void {
        this.path = '/videos';
    }

    protected initializeRoutes(): void {
        super.initializeRoutes();
    }

    protected async getData(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'MENTOR') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        // super.getData(req,res,next)
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
                    include: {
                        required: false,
                        model: reflective_quiz_question,
                        where: {
                            [Op.and]: [
                                whereClauseStatusPart
                            ]
                        },
                    },
                });
                data = await this.formatOneRowProperly(req, res, data)
            } else {
                try {
                    const responseOfFindAndCountAll = await this.crudService.findAndCountAll(modelClass, {
                        where: {
                            [Op.and]: [
                                whereClauseStatusPart,
                                condition
                            ]
                        },
                        include: {
                            required: false,
                            model: reflective_quiz_question,
                            where: {
                                [Op.and]: [
                                    whereClauseStatusPart
                                ]
                            },
                        },
                        limit,
                        offset
                    })
                    let result = this.getPagingData(responseOfFindAndCountAll, page, limit);

                    result = await this.formatAllRowsProperly(req, res, result);

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

    protected async formatOneRowProperly(req: Request, res: Response, data: any) {
        let dataModified = JSON.parse(JSON.stringify(data));
        const newVideoRow = dataModified
        let user_id = res.locals.user_id;
        if (!user_id) {
            throw unauthorized(speeches.UNAUTHORIZED_ACCESS)
        }
        const newQuestionsFomratted = dataModified.reflective_quiz_questions.map((questionRaw: any) => {

            let resultQuestion: any = {}
            let optionsArr = []

            if (questionRaw.option_a) {
                optionsArr.push(questionRaw.option_a)
            }
            if (questionRaw.option_b) {
                optionsArr.push(questionRaw.option_b)
            }
            if (questionRaw.option_c) {
                optionsArr.push(questionRaw.option_c)
            }
            if (questionRaw.option_d) {
                optionsArr.push(questionRaw.option_d)
            }
            resultQuestion["video_id"] = questionRaw.video_id;
            resultQuestion["reflective_quiz_question_id"] = questionRaw.reflective_quiz_question_id;
            resultQuestion["question_no"] = questionRaw.question_no;
            resultQuestion["question"] = questionRaw.question;
            resultQuestion["question_image"] = questionRaw.question_image;
            resultQuestion["options"] = optionsArr;
            resultQuestion["level"] = questionRaw.level;
            resultQuestion["type"] = questionRaw.type;
            resultQuestion["rfq_status"] = questionRaw.rfq_status;
            return resultQuestion;
        })

        newVideoRow.reflective_quiz_questions = newQuestionsFomratted
        if (newQuestionsFomratted && newQuestionsFomratted.length > 0) {
            //TODO:
            //db intensive operation especially for a loop 
            //optimise it going forward 
            const nextQuestionsToChooseFrom = await this.reflectiveQuizService.fetchNextQuestion(user_id, dataModified.video_id, null)

            if (nextQuestionsToChooseFrom) {
                newVideoRow.reflective_quiz_status = "INCOMPLETE"
            } else {
                newVideoRow.reflective_quiz_status = "COMPLETED"
            }

        } else {
            newVideoRow.reflective_quiz_status = "COMPLETED";
        }

        return newVideoRow;
    }
    protected async formatAllRowsProperly(req: Request, res: Response, data: any) {
        let result: any = {}
        let dataModified = JSON.parse(JSON.stringify(data));

        result = await Promise.all(
            dataModified.dataValues.map(async (videoRow: any) => {
                return await this.formatOneRowProperly(req, res, videoRow)
            })
        )
        return result;
    }

}