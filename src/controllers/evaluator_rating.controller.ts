import { evaluatorRatingSchema, evaluatorRatingUpdateSchema } from "../validations/evaluator_rating.validations";
import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";

export default class EvaluatorRatingController extends BaseController {

    model = "evaluator_rating";

    protected initializePath(): void {
        this.path = '/evaluatorRating';
    }

    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(evaluatorRatingSchema, evaluatorRatingUpdateSchema);
    }

    protected initializeRoutes(): void {
        super.initializeRoutes();
    }
};