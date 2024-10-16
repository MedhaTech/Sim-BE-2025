import Joi from 'joi';
import { constents } from '../configs/constents.config';

export const state_coordinatorSchema = Joi.object().keys({
    whatapp_link: Joi.string(),
    ideaSubmission: Joi.string().regex(constents.ONLY_DIGIT_PATTERN),
    certificate: Joi.string().regex(constents.ONLY_DIGIT_PATTERN),
    mentor_note: Joi.string(),
    student_note: Joi.string()
});

export const state_coordinatorUpdateSchema = Joi.object().keys({
    status: Joi.string().valid(...Object.values(constents.common_status_flags.list)),
    whatapp_link: Joi.string(),
    ideaSubmission: Joi.number(),
    certificate: Joi.number(),
    mentor_note: Joi.string(),
    student_note: Joi.string()
});
