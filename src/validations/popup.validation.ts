import Joi from 'joi';
import { constents } from '../configs/constents.config';
import { speeches } from '../configs/speeches.config';

export const popupSchema = Joi.object().keys({
    on_off: Joi.string().trim().min(1).required().regex(constents.ALPHA_NUMERIC_PATTERN),
    url: Joi.string().trim().min(1).required(),
    role: Joi.string().required().regex(constents.ALPHA_NUMERIC_PATTERN),
    type: Joi.string().required().regex(constents.ALPHA_NUMERIC_PATTERN),
    navigate:Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN_PLUS_SLASH),
    state:Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN)
});

export const popupUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)).messages({
        'any.only': speeches.COMMON_STATUS_INVALID,
        'string.empty': speeches.COMMON_STATUS_REQUIRED
    }),
    on_off: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    url: Joi.string(),
    role: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    type: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    navigate:Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN_PLUS_SLASH),
    state:Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN)
});