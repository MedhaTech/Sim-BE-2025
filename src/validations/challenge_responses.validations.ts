import Joi from 'joi';
import { constents } from '../configs/constents.config';
import { speeches } from '../configs/speeches.config';

export const challengeResponsesUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.evaluation_status.list)).required().messages({
        'any.only': speeches.EVALUATOR_STATUS_INVALID,
        'string.empty': speeches.EVALUATOR_STATUS_REQUIRED
    }),
    'rejected_reason': Joi.any(),
    'rejected_reasonSecond':Joi.any()
});
export const UpdateAnyFieldSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.challenges_flags.list)).messages({
        'any.only': speeches.COMMON_STATUS_INVALID,
        'string.empty': speeches.COMMON_STATUS_REQUIRED
    }),
    team_id: Joi.number().min(1),
    response: Joi.string().trim().min(1),
    evaluated_by: Joi.number().min(1),
    evaluated_at: Joi.any(),
    theme: Joi.any(),
    district: Joi.string(),
    state: Joi.string(),
    others: Joi.any(),
    final_result: Joi.any(),
    initiated_by: Joi.any(),
    focus_area:Joi.any()
});
export const initiateIdeaSchema = Joi.object().keys({
    theme: Joi.string().required().messages({
        'any.only': speeches.COMMON_STATUS_INVALID,
    }),
    focus_area:Joi.string().required(),
    title:Joi.string().required(),
    problem_statement:Joi.string().required()
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
    focus_area:Joi.any()
});