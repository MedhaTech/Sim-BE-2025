
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import { emailSchema, emailUpdateSchema } from "../validations/email.validations";

export default class EmailController extends BaseController {

    model = "email";

    protected initializePath(): void {
        this.path = '/emails';
    }
    protected initializeValidations(): void {
        this.validations =  new ValidationsHolder(emailSchema,emailUpdateSchema);
    }
    protected initializeRoutes(): void {
        super.initializeRoutes();
    }
} 
