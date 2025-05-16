import { badData, badRequest, internal, unauthorized } from "boom";
import { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import { constents } from "../configs/constents.config";
import { speeches } from "../configs/speeches.config";
import validationMiddleware from "../middlewares/validation.middleware";
import { course_topic } from "../models/course_topic.model";
import { mentor_course_topic } from "../models/mentor_course_topic.model";
import { quiz_question } from "../models/quiz_question.model";
import { quiz_response } from "../models/quiz_response.model";
import { video } from "../models/video.model";
import dispatcher from "../utils/dispatch.util";
import { quizSchema, quizSubmitResponseSchema, quizUpdateSchema } from "../validations/quiz.validations";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import db from "../utils/dbconnection.util"

export default class QuizController extends BaseController {

    model = "quiz";

    protected initializePath(): void {
        this.path = '/quiz';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(quizSchema, quizUpdateSchema);
    }
    protected initializeRoutes(): void {
        this.router.get(this.path + "/:id/nextQuestion/", this.getNextQuestion.bind(this));
        this.router.post(this.path + "/:id/response/", validationMiddleware(quizSubmitResponseSchema), this.submitResponse.bind(this));
        this.router.get(this.path + "/result", this.getResult.bind(this));
    }

    /**
     * 
     * Note this api gets used by two journeys .. student as well mentor and both have diff logics and so a fw assumptions have been made do read all comments in the function below 
     * @param req 
     * @param res 
     * @param next 
     */
    protected async getNextQuestion(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            const quiz_id = newParamId;
            const attempts = newREQQuery.attempts;
            const paramStatus: any = newREQQuery.status;
            const user_id = newREQQuery.user_id;
            let isMentorCourse = false;
            if (!quiz_id) {
                throw badRequest(speeches.QUIZ_ID_REQUIRED);
            }
            if (!user_id) {
                throw unauthorized(speeches.UNAUTHORIZED_ACCESS);
            }
            if (!attempts) {
                throw unauthorized(speeches.ATTEMPTS_REQUIRED);
            }
            //check if the given quiz is a valid topic
            const curr_topic = await this.crudService.findOne(course_topic, { where: { "topic_type_id": quiz_id, "topic_type": "QUIZ", status: 'ACTIVE' } })
            if (!curr_topic || curr_topic instanceof Error) {

                //here we have made a mjor assumption that mentor quiz_id and student quiz ids will be diff and that one quiz_id cannot be added in both student and mentor course_topic tables(these are two diff tables) , if u do so it will be considered as student course api
                const curr_topic = await this.crudService.findOne(mentor_course_topic, { where: { "topic_type_id": quiz_id, "topic_type": "QUIZ" } })
                if (!curr_topic || curr_topic instanceof Error) {
                    throw badRequest("INVALID TOPIC");
                }
                isMentorCourse = true;
            }

            const quizRes = await this.crudService.findOne(quiz_response, { where: { quiz_id: quiz_id, user_id: user_id, attempts: attempts } });
            if (quizRes instanceof Error) {
                throw internal(quizRes.message)
            }
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
            let level = "HARD"
            let question_no = 1
            let nextQuestion: any = null;
            if (quizRes) {

                let user_response: any = {}
                user_response = JSON.parse(quizRes.dataValues.response);

                let questionNosAsweredArray = Object.keys(user_response);
                questionNosAsweredArray = questionNosAsweredArray.sort((a, b) => (Number(a) > Number(b) ? -1 : 1));

                const noOfQuestionsAnswered = Object.keys(user_response).length

                const lastQuestionAnsewered = user_response[questionNosAsweredArray[0]]//we have assumed that this length will always have atleast 1 item ; this could potentially be a source of bug, but is not since this should always be true based on above checks ..
                if (lastQuestionAnsewered.selected_option == lastQuestionAnsewered.correct_answer) {
                    question_no = lastQuestionAnsewered.question_no + 1;


                } else if (!isMentorCourse) {// converted to else if from else to take into account diff behaviour of mentor course which is it doesnt have hard medium easy instead it will have only one question per question no which is hard

                    question_no = lastQuestionAnsewered.question_no + 1;
                    level = "HARD"

                } else {

                    //since this is mentor quiz id hence next question will not advance to easy medium instead will remain on same question untill answered correctly
                    question_no = lastQuestionAnsewered.question_no + 1;

                    level = "HARD"

                }
            }

            const nextQuestionsToChooseFrom = await this.crudService.findOne(quiz_question, {
                where: {
                    [Op.and]: [
                        whereClauseStatusPart,
                        { quiz_id: quiz_id },
                        { level: level },
                        { question_no: question_no },
                    ]

                }
            })

            if (nextQuestionsToChooseFrom instanceof Error) {
                throw internal(nextQuestionsToChooseFrom.message)
            }
            if (nextQuestionsToChooseFrom) {
                let resultQuestion: any = {}
                let optionsArr = []
                if (nextQuestionsToChooseFrom.dataValues.option_a) {
                    optionsArr.push(nextQuestionsToChooseFrom.dataValues.option_a)
                }
                if (nextQuestionsToChooseFrom.dataValues.option_b) {
                    optionsArr.push(nextQuestionsToChooseFrom.dataValues.option_b)
                }
                if (nextQuestionsToChooseFrom.dataValues.option_c) {
                    optionsArr.push(nextQuestionsToChooseFrom.dataValues.option_c)
                }
                if (nextQuestionsToChooseFrom.dataValues.option_d) {
                    optionsArr.push(nextQuestionsToChooseFrom.dataValues.option_d)
                }


                resultQuestion["quiz_id"] = nextQuestionsToChooseFrom.dataValues.quiz_id;
                resultQuestion["quiz_question_id"] = nextQuestionsToChooseFrom.dataValues.quiz_question_id;
                resultQuestion["question_no"] = nextQuestionsToChooseFrom.dataValues.question_no;
                resultQuestion["question"] = nextQuestionsToChooseFrom.dataValues.question;
                resultQuestion["question_image"] = nextQuestionsToChooseFrom.dataValues.question_image;
                resultQuestion["question_icon"] = nextQuestionsToChooseFrom.dataValues.question_icon;
                resultQuestion["options"] = optionsArr;
                resultQuestion["level"] = nextQuestionsToChooseFrom.dataValues.level;
                resultQuestion["type"] = nextQuestionsToChooseFrom.dataValues.type;

                res.status(200).send(dispatcher(res, resultQuestion))
            } else {
                res.status(200).send(dispatcher(res, "Quiz has been completed no more questions to display"))
            }
        } catch (err) {
            next(err)
        }


    }
    //creating quiz response of the user
    protected async submitResponse(req: Request, res: Response, next: NextFunction) {
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
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            const quiz_id = newParamId;

            const { quiz_question_id, attempts } = req.body;
            let selected_option = req.body.selected_option;
            selected_option = res.locals.translationService.getTranslationKey(selected_option)

            const user_id = newREQQuery.user_id;
            if (!quiz_id) {
                throw badRequest(speeches.QUIZ_ID_REQUIRED);
            }
            if (!quiz_question_id) {
                throw badRequest(speeches.QUIZ_QUESTION_ID_REQUIRED);
            }

            if (!user_id) {
                throw unauthorized(speeches.UNAUTHORIZED_ACCESS);
            }
            if (!attempts) {
                throw unauthorized(speeches.ATTEMPTS_REQUIRED);
            }

            const questionAnswered = await this.crudService.findOne(quiz_question, { where: { quiz_question_id: quiz_question_id } });
            if (questionAnswered instanceof Error) {
                throw internal(questionAnswered.message)
            }
            if (!questionAnswered) {
                throw badData("Invalid Quiz question id")
            }

            let topic_to_redirect_to = null;
            if (questionAnswered.dataValues.redirect_to) {
                topic_to_redirect_to = await this.crudService.findOne(course_topic, {
                    where: {
                        course_topic_id: questionAnswered.dataValues.redirect_to
                    },
                    include: [{
                        model: video,
                        as: 'video',
                        required: false
                    }]
                })
            }
            if (topic_to_redirect_to instanceof Error) {
                console.log(topic_to_redirect_to);
                topic_to_redirect_to = null
            }

            const quizRes = await this.crudService.findOne(quiz_response, { where: { quiz_id: quiz_id, user_id: user_id, attempts: attempts } });
            if (quizRes instanceof Error) {
                throw internal(quizRes.message)
            }

            let dataToUpsert: any = {}
            dataToUpsert = { quiz_id: quiz_id, user_id: user_id, updated_by: user_id }

            //check if question was ansered correctly
            let hasQuestionBeenAnsweredCorrectly = false;
            if (questionAnswered.type == "TEXT" || questionAnswered.type == "DRAW") {
                hasQuestionBeenAnsweredCorrectly = true;
            } else if (!questionAnswered.correct_ans || questionAnswered.correct_ans == "(())" || questionAnswered.correct_ans == "") {
                hasQuestionBeenAnsweredCorrectly = true;
            }
            else {
                hasQuestionBeenAnsweredCorrectly = selected_option == questionAnswered.correct_ans
            }

            let updateScore = quizRes.score;
            if (hasQuestionBeenAnsweredCorrectly === true) {
                if (updateScore === undefined) {
                    updateScore = 1
                }
                else {
                    updateScore = updateScore + 1;
                }
            }
            let responseObjToAdd: any = {}
            responseObjToAdd = {
                ...req.body,
                question: questionAnswered.dataValues.question,
                correct_answer: questionAnswered.dataValues.correct_ans,
                level: questionAnswered.dataValues.level,
                question_no: questionAnswered.dataValues.question_no,
                is_correct: hasQuestionBeenAnsweredCorrectly,
                score: updateScore
            }

            let user_response: any = {}
            if (quizRes) {

                user_response = JSON.parse(quizRes.dataValues.response);
                user_response[questionAnswered.dataValues.question_no] = responseObjToAdd;

                dataToUpsert["response"] = JSON.stringify(user_response);
                dataToUpsert['score'] = responseObjToAdd.score;

                const resultModel = await this.crudService.update(quizRes, dataToUpsert, { where: { quiz_id: quiz_id, user_id: user_id } })
                if (resultModel instanceof Error) {
                    throw internal(resultModel.message)
                }
                let result: any = {}
                result = resultModel.dataValues
                result["is_correct"] = responseObjToAdd.is_correct;
                result['correct_answer'] = responseObjToAdd.correct_answer;
                result['score'] = responseObjToAdd.score
                if (responseObjToAdd.is_correct) {
                    result["msg"] = questionAnswered.dataValues.msg_ans_correct;
                    result["ar_image"] = questionAnswered.dataValues.ar_image_ans_correct;
                    result["ar_video"] = questionAnswered.dataValues.ar_video_ans_correct;
                    result["accimg"] = questionAnswered.dataValues.accimg_ans_correct;
                } else {
                    result["msg"] = questionAnswered.dataValues.msg_ans_wrong;
                    result["ar_image"] = questionAnswered.dataValues.ar_image_ans_wrong;

                    result["ar_video"] = topic_to_redirect_to
                    result["accimg"] = questionAnswered.dataValues.accimg_ans_wrong;
                }
                result["redirect_to"] = topic_to_redirect_to;
                res.status(200).send(dispatcher(res, result));
            } else {

                user_response[questionAnswered.dataValues.question_no] = responseObjToAdd;

                dataToUpsert["response"] = JSON.stringify(user_response);
                dataToUpsert = { ...dataToUpsert, created_by: user_id }
                dataToUpsert['score'] = responseObjToAdd.score;
                dataToUpsert['attempts'] = attempts;

                const resultModel = await this.crudService.create(quiz_response, dataToUpsert)
                if (resultModel instanceof Error) {
                    throw internal(resultModel.message)
                }
                let result: any = {}
                result = resultModel.dataValues
                result["is_correct"] = responseObjToAdd.is_correct;
                result['correct_answer'] = responseObjToAdd.correct_answer;
                result['score'] = responseObjToAdd.score;
                if (responseObjToAdd.is_correct) {
                    result["msg"] = questionAnswered.dataValues.msg_ans_correct;
                    result["ar_image"] = questionAnswered.dataValues.ar_image_ans_correct;
                    result["ar_video"] = questionAnswered.dataValues.ar_video_ans_correct;
                    result["accimg"] = questionAnswered.dataValues.accimg_ans_correct;
                } else {
                    result["msg"] = questionAnswered.dataValues.msg_ans_wrong;
                    result["ar_image"] = questionAnswered.dataValues.ar_image_ans_wrong;

                    result["ar_video"] = topic_to_redirect_to
                    result["accimg"] = questionAnswered.dataValues.accimg_ans_wrong;
                }
                result["redirect_to"] = topic_to_redirect_to;
                res.status(200).send(dispatcher(res, result));
            }
        } catch (err) {
            next(err)
        }
    }

    //fetching quiz score of the user by user_id
    protected async getResult(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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
            const { user_id, quiz_id } = newREQQuery;
            let result: any = {}
            const totalquestions = await db.query(`SELECT count(*) as allquestions FROM quiz_questions where quiz_id = ${quiz_id} and status = 'ACTIVE'`);
            result['all'] = totalquestions[0];
            const user_quizData = await this.crudService.findAll(quiz_response, { where: { quiz_id: quiz_id, user_id: user_id } });
            if (user_quizData.length !== 0) {
                result['data'] = user_quizData;
                res.status(200).send(dispatcher(res, result));
            }
            else {
                res.status(200).send(dispatcher(res, "user not stared"));
            }
        } catch (err) {
            next(err)
        }


    }
}