import Joi from 'joi';
import { constents } from '../configs/constents.config';
import { speeches } from '../configs/speeches.config';

export const studentSchema = Joi.object().keys({
    username: Joi.string().required().messages({
        'string.empty': speeches.USER_USERNAME_REQUIRED
    }),
    full_name: Joi.string().trim().min(1).regex(constents.ALPHA_NUMERIC_PATTERN).required().messages({
        'string.empty': speeches.USER_FULLNAME_REQUIRED
    }),
    role: Joi.string().required().messages({
        'string.empty': speeches.USER_ROLE_REQUIRED
    }),
    team_id: Joi.string().required().messages({
        'string.empty': speeches.USER_TEAMID_REQUIRED
    }),
});

export const studentLoginSchema = Joi.object().keys({
    username: Joi.string().required().messages({
        'string.empty': speeches.USER_USERNAME_REQUIRED
    }),
    password: Joi.string().required().messages({
        'string.empty': speeches.USER_PASSWORD_REQUIRED
    })
});
export const studentChangePasswordSchema = Joi.object().keys({
    user_id: Joi.string().required().messages({
        'string.empty': speeches.USER_USERID_REQUIRED
    }),
    old_password: Joi.string().required().messages({
        'string.empty': speeches.USER_OLDPASSWORD_REQUIRED
    }),
    new_password: Joi.string().trim().min(1).required().messages({
        'string.empty': speeches.USER_NEWPASSWORD_REQUIRED
    })
});
export const studentResetPasswordSchema = Joi.object().keys({
    user_id: Joi.string().required().messages({
        'string.empty': speeches.USER_USERID_REQUIRED
    })
});

export const studentUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)),
    full_name: Joi.string().trim().min(1).regex(constents.ALPHA_NUMERIC_PATTERN),
    Age: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    Grade: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    team_id: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    disability: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    username: Joi.string().email(),
    Gender: Joi.string().valid(...Object.values(constents.gender_flags.list))
});
export const studentRegSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)),
    full_name: Joi.string().trim().min(1).regex(constents.ALPHA_NUMERIC_PATTERN),
    Age: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    Grade: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    team_id: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    disability: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN),
    username: Joi.string().email(),
    Gender: Joi.string().valid(...Object.values(constents.gender_flags.list)),
    role: Joi.string().regex(constents.ALPHA_NUMERIC_PATTERN).messages({
        'string.empty': speeches.USER_ROLE_REQUIRED
    }),
});