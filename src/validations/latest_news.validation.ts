import Joi from 'joi';
import { constents } from '../configs/constents.config';
import { speeches } from '../configs/speeches.config';

export const latest_newsSchema = Joi.object().keys({
    details: Joi.string().required().messages({
        'string.empty': speeches.ID_REQUIRED
    }),
    category: Joi.string().required().regex(constents.ALPHA_NUMERIC_PATTERN).messages({
        'string.empty': speeches.ID_REQUIRED
    }),
    url: Joi.string(),
    file_name: Joi.string(),
    new_status: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    state: Joi.string().required().regex(constents.ALPHA_NUMERIC_PATTERN).messages({
        'string.empty': speeches.STATE_REQ
    }),
});

export const latest_newsUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)).required().messages({
        'any.only': speeches.COMMON_STATUS_INVALID,
        'string.empty': speeches.COMMON_STATUS_REQUIRED
    }),
    category: Joi.string().required().regex(constents.ALPHA_NUMERIC_PATTERN).messages({
        'string.empty': speeches.ID_REQUIRED
    }),
    details: Joi.string().required().messages({
        'string.empty': speeches.ID_REQUIRED
    }),
    url: Joi.any(),
    file_name: Joi.any(),
    new_status: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    state: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN)
});