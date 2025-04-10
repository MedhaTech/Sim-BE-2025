import Joi from 'joi';
import { constents } from '../configs/constents.config';
import { speeches } from '../configs/speeches.config';

export const stateSchema = Joi.object().keys({
    username: Joi.string().trim().min(1).required().email().messages({
        'string.empty': speeches.USER_USERNAME_REQUIRED
    }),
    full_name: Joi.string().trim().min(1).regex(constents.ALPHA_NUMERIC_PATTERN).required().messages({
        'string.empty': speeches.USER_FULLNAME_REQUIRED
    }),
    role: Joi.string().required().messages({
        'string.empty': speeches.USER_ROLE_REQUIRED
    }),
    password: Joi.string()
});

export const stateUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)),
    username: Joi.string().trim().min(1).email(),
    full_name: Joi.string().trim().min(1).regex(constents.ALPHA_NUMERIC_PATTERN),
    password: Joi.string()
});

export const stateLoginSchema = Joi.object().keys({
    username: Joi.string().required().messages({
        'string.empty': speeches.USER_USERNAME_REQUIRED
    }),
    password: Joi.string().required().messages({
        'string.empty': speeches.USER_PASSWORD_REQUIRED
    })
});

export const stateChangePasswordSchema = Joi.object().keys({
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

export const state_specificUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)),
    whatapp_link: Joi.string(),
    ideaSubmission: Joi.number(),
    certificate: Joi.number(),
    mentor_note: Joi.string(),
    student_note: Joi.string()
});

