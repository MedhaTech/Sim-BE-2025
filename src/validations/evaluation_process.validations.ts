import Joi from 'joi';
import { constents } from '../configs/constents.config';
import { speeches } from '../configs/speeches.config';

export const evaluationProcessSchema = Joi.object().keys({
    level_name: Joi.string().trim().min(1),
    state: Joi.string(),
    no_of_evaluation: Joi.number(),
    eval_schema: Joi.string().valid(...Object.values(constents.evaluation_process_status_flags.list)),
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)),
    theme: Joi.string(),
    language: Joi.string()
});

export const evaluationProcessUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)).messages({
        'any.only': speeches.COMMON_STATUS_INVALID,
        'string.empty': speeches.COMMON_STATUS_REQUIRED
    }),
    level_name: Joi.string(),
    state: Joi.string(),
    no_of_evaluation: Joi.number(),
    theme: Joi.string(),
    language: Joi.string()
});