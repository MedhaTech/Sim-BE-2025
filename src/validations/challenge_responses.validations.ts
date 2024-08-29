import Joi from 'joi';
import { constents } from '../configs/constents.config';
import { speeches } from '../configs/speeches.config';

export const challengeResponsesUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.evaluation_status.list)).required().messages({
        'any.only': speeches.EVALUATOR_STATUS_INVALID,
        'string.empty': speeches.EVALUATOR_STATUS_REQUIRED
    }),
    'rejected_reason': Joi.any(),
    'rejected_reasonSecond': Joi.any()
});
export const UpdateAnyFieldSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.challenges_flags.list)).messages({
        'any.only': speeches.COMMON_STATUS_INVALID,
        'string.empty': speeches.COMMON_STATUS_REQUIRED
    }),
    team_id: Joi.number().min(1),
    initiated_by: Joi.number(),
    theme: Joi.string(),
    others: Joi.string(),
    focus_area: Joi.string(),
    title: Joi.string(),
    problem_statement: Joi.string(),
    causes: Joi.string(),
    effects: Joi.string(),
    community: Joi.string(),
    facing: Joi.string(),
    solution: Joi.string(),
    stakeholders: Joi.string(),
    problem_solving: Joi.string(),
    feedback: Joi.string(),
    prototype_image: Joi.string(),
    prototype_link: Joi.string(),
    workbook: Joi.string(),
    verified_status: Joi.string(),
    verified_at: Joi.date(),
    mentor_rejected_reason: Joi.string(),
    evaluated_by: Joi.number().min(1),
    evaluated_at: Joi.date(),
    rejected_reason: Joi.string(),
    rejected_reasonSecond: Joi.string(),
    district: Joi.string(),
    state: Joi.string(),
    final_result: Joi.number()
});
export const initiateIdeaSchema = Joi.object().keys({
    theme: Joi.string().required().messages({
        'any.only': speeches.COMMON_STATUS_INVALID,
    }),
    focus_area: Joi.string().required(),
    title: Joi.string().required(),
    problem_statement: Joi.string().required(),
    causes: Joi.string(),
    effects: Joi.string(),
    community: Joi.string(),
    facing: Joi.string(),
    solution: Joi.string(),
    stakeholders: Joi.string(),
    problem_solving: Joi.string(),
    feedback: Joi.string(),
    prototype_image: Joi.string(),
    prototype_link: Joi.string(),
    workbook: Joi.string(),
});
export const challengeResponsesSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.challenges_flags.list)).required().messages({
        'any.only': speeches.COMMON_STATUS_INVALID,
        'string.empty': speeches.COMMON_STATUS_REQUIRED
    }),
    theme: Joi.any(),
    others: Joi.any(),
    state: Joi.string(),
    district: Joi.string(),
    focus_area: Joi.any()
});