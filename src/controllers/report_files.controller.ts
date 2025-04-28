import ValidationsHolder from "../validations/validationHolder";
import BaseController from "./base.controller";
import { report_fileSchema, report_fileUpdateSchema } from "../validations/report_files.validations";

export default class ReportFilesController extends BaseController {

    model = "report_file";

    protected initializePath(): void {
        this.path = '/report_files';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(report_fileSchema, report_fileUpdateSchema);
    }
    protected initializeRoutes(): void {
        super.initializeRoutes();
    }
} 
