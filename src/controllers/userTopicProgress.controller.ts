
import { badRequest, unauthorized } from "boom";
import { Request, Response, NextFunction } from "express";
import { speeches } from "../configs/speeches.config";
import dispatcher from "../utils/dispatch.util";
import { userTopicProgressSchema, userTopicProgressUpdateSchema, } from "../validations/userTopicProgress.validations";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";

export default class UserTopicProgress extends BaseController {

    model = "user_topic_progress";

    protected initializePath(): void {
        this.path = '/userTopicProgress';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(userTopicProgressSchema, userTopicProgressUpdateSchema);
    }
    protected initializeRoutes(): void {
        super.initializeRoutes();
    }

    protected async createData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM') {
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
            const { model } = req.params;
            const { course_topic_id } = req.body;
            if (model) {
                this.model = model;
            };
            let user_id = newREQQuery.user_id;
            if (!user_id) {
                throw unauthorized(speeches.UNAUTHORIZED_ACCESS)
            }

            const modelLoaded = await this.loadModel(model);

            //check if the topic progress already exists then don't create a new entry
            const topicProgressAlreadyPresent = await modelLoaded.findOne({
                where: {
                    user_id: user_id,
                    course_topic_id: course_topic_id
                }
            })

            if (topicProgressAlreadyPresent instanceof Error) {
                throw topicProgressAlreadyPresent
            }

            let payload = this.autoFillTrackingColumns(req, res, modelLoaded)
            payload.user_id = user_id;
            let data = {}
            let msg = "OK";
            if (topicProgressAlreadyPresent) {
                const alreadyPresentStatus = topicProgressAlreadyPresent.dataValues.status;
                if (alreadyPresentStatus.toLowerCase() != payload.status.toLowerCase()) {
                    data = await this.crudService.updateAndFind(modelLoaded, payload, {
                        where: {
                            user_id: user_id,
                            course_topic_id: course_topic_id
                        }
                    });
                } else {
                    data = topicProgressAlreadyPresent
                    msg = "topic status was already " + alreadyPresentStatus
                }
            } else {
                data = await this.crudService.create(modelLoaded, payload);
            }

            if (data instanceof Error) {
                throw badRequest(data.message)
            }
            if (!data) {
                throw badRequest("sorry return data is empty.")
            }
            return res.status(201).send(dispatcher(res, data, 'created', msg));
        } catch (error) {
            next(error);
        }
    }
} 
