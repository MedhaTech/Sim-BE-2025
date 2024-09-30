import Joi from 'joi';
import { constents } from '../configs/constents.config';

export const emailSchema = Joi.object().keys({
    msg:Joi.string().required(),
    subject:Joi.string().required().regex(constents.ALPHA_NUMERIC_PLUS_PATTERN),
});

export const emailUpdateSchema = Joi.object().keys({
    status: Joi.string().valid('ACTIVE', 'INACTIVE')
});

