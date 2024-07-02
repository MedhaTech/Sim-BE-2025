import "dotenv/config";
import validateEnv from "./utils/validate_env";
import App from "./app";

import AdminController from "./controllers/admin.controller";
import OrganizationController from "./controllers/organization.controller";
import MentorController from "./controllers/mentor.controller";
import StateController from "./controllers/state.controller";
import StudentController from "./controllers/student.controller";
import popupController from "./controllers/popup.controller";
import LatestNewsController from "./controllers/latest_news.controller";
import ResourceController from "./controllers/resource.controller";
import TeamController from "./controllers/team.controller";
import QuizSurveyController from "./controllers/quiz_survey.controller";
import VideoController from "./controllers/video.controller";
import SupportTicketController from "./controllers/supportTickets.controller";
import SupportTicketRepliesController from "./controllers/supportTicketsReplies.controller";


// validating env variables
validateEnv();

try {
    // initializing app
    const app = new App([
        new AdminController,
        new OrganizationController,
        new MentorController,
        new StateController,
        new StudentController,
        new popupController,
        new LatestNewsController,
        new ResourceController,
        new TeamController,
        new QuizSurveyController,
        new VideoController,
        new SupportTicketController,
        new SupportTicketRepliesController
    ], Number(process.env.APP_PORT));
    // starting app
    app.listen();
} catch (error) {
    console.log(error);
}