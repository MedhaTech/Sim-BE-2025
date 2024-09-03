import Joi from 'joi';
import { constents } from '../configs/constents.config';
import { speeches } from '../configs/speeches.config';

export const studentSchema = Joi.object().keys({
    full_name: Joi.string().trim().min(1).regex(constents.ALPHA_NUMERIC_PATTERN).required().messages({
        'string.empty': speeches.USER_FULLNAME_REQUIRED
    }),
    role: Joi.string().required().regex(constents.ALPHA_NUMERIC_PATTERN).messages({
        'string.empty': speeches.USER_ROLE_REQUIRED
    }),
    team_id: Joi.string().required().regex(constents.ALPHA_NUMERIC_PATTERN).messages({
        'string.empty': speeches.USER_TEAMID_REQUIRED
    }),
    Age: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    Grade: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    disability: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    Gender: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    state:Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN)
});

export const studentUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)),
    full_name: Joi.string().trim().min(1).regex(constents.ALPHA_NUMERIC_PATTERN),
    Age: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    Grade: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    team_id: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    disability: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    Gender: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN)
});
