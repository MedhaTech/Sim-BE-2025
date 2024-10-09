import { evaluationProcessSchema, evaluationProcessUpdateSchema } from "../validations/evaluation_process.validations";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";

export default class EvaluationProcess extends BaseController {

    model = "evaluation_process";

    protected initializePath(): void {
        this.path = '/evaluationProcess';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(evaluationProcessSchema, evaluationProcessUpdateSchema);
    }
    protected initializeRoutes(): void {
        super.initializeRoutes();
    }
}