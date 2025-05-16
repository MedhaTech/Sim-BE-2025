import { NextFunction, Request, Response } from "express";
import { speeches } from "../configs/speeches.config";
import { faq } from "../models/faq.model";
import { faqCategorySchema, faqCategorySchemaUpdateSchema } from "../validations/faq_category.validations";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import db from "../utils/dbconnection.util"
import { unauthorized } from "boom";

export default class FaqCategoryController extends BaseController {

    model = "faq_category";

    protected initializePath(): void {
        this.path = '/faqCategories';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(faqCategorySchema, faqCategorySchemaUpdateSchema);
    }
    protected initializeRoutes(): void {
        super.initializeRoutes();
    }
    //fetching all the faq details
    protected getData(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM') {
            throw unauthorized(speeches.ROLE_ACCES_DECLINE)
        }
        let objWhereClauseStatusPart = this.getWhereClauseStatsPart(req);
        return super.getData(req, res, next, [],
            [
                'category_name',
                'faq_category_id',
                [
                    db.literal(`( SELECT COUNT(*) FROM faqs AS s WHERE
                    ${objWhereClauseStatusPart.addWhereClauseStatusPart ? "s." + objWhereClauseStatusPart.whereClauseStatusPartLiteral : objWhereClauseStatusPart.whereClauseStatusPartLiteral}
                    AND s.faq_category_id = \`faq_category\`.\`faq_category_id\`)`), 'faq_count'
                ]
            ], { model: faq, required: false }
        )
    }
}