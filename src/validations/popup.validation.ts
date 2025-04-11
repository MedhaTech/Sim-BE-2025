import Joi from 'joi';
import { constents } from '../configs/constents.config';
import { speeches } from '../configs/speeches.config';

export const popupSchema = Joi.object().keys({
    on_off: Joi.string().trim().min(1).required().regex(constents.ALPHA_NUMERIC_PATTERN),
    url: Joi.string().trim().allow(null).allow(''),
    file:Joi.string().trim().allow(null).allow(''),
    image:Joi.string().trim().allow(null).allow(''),
    youtube:Joi.string().trim().allow(null).allow(''),
    role: Joi.string().required().regex(constents.ALPHA_NUMERIC_PATTERN),
    navigate:Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN_PLUS_SLASH).allow(null).allow(''),
    state:Joi.string().required().regex(constents.ALPHA_NUMERIC_PATTERN)
});

export const popupUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)).messages({
        'any.only': speeches.COMMON_STATUS_INVALID,
        'string.empty': speeches.COMMON_STATUS_REQUIRED
    }),
    on_off: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    url: Joi.string().trim().allow(null).allow(''),
    file:Joi.string().trim().allow(null).allow(''),
    image:Joi.string().trim().allow(null).allow(''),
    youtube:Joi.string().trim().allow(null).allow(''),
    role: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    navigate:Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN_PLUS_SLASH).allow(null).allow(''),
    state:Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN)
});