import Joi from 'joi';
import { constents } from '../configs/constents.config';

export const report_fileSchema = Joi.object().keys({
    report_name: Joi.string().required().regex(constents.ALPHA_NUMERIC_PLUS_PATTERN),
    filters: Joi.string().required().regex(constents.ALPHA_NUMERIC_PLUS_PATTERN),
    columns: Joi.string().required().regex(constents.ALPHA_NUMERIC_PLUS_PATTERN),
    report_type: Joi.string().required().regex(constents.ALPHA_NUMERIC_PLUS_PATTERN)
});

export const report_fileUpdateSchema = Joi.object().keys({
    status: Joi.string().valid('ACTIVE', 'INACTIVE')
});

