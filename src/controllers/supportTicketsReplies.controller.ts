import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import { supportTicketsReplies, supportTicketsRepliesUpdateSchema } from "../validations/supportTicketReplies.validation";


export default class SupportTicketRepliesController extends BaseController {
    model = "support_ticket_reply";
    protected initializePath(): void {
        this.path = "/supportTicketsReply";
    };
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(supportTicketsReplies, supportTicketsRepliesUpdateSchema);
    };
    protected initializeRoutes(): void {
        //example route to add
        super.initializeRoutes();
    };
};