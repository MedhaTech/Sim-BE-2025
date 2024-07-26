
import { worksheetSchema, worksheetUpdateSchema } from "../validations/worksheet.validations";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";

export default class MentorAttachmentController extends BaseController {

    model = "mentor_attachment";

    protected initializePath(): void {
        this.path = '/mentorAttachments';
    }
    protected initializeValidations(): void {
        this.validations =  new ValidationsHolder(worksheetSchema,worksheetUpdateSchema);
    }
    protected initializeRoutes(): void {
        super.initializeRoutes();
    }
} 
