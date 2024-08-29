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
import CourseController from "./controllers/course.controller";
import FaqCategoryController from "./controllers/faq_category.controller";
import FaqController from "./controllers/faq.controller";
import MentorCourseController from "./controllers/mentorCourse.controller";
import MentorTopicProgressController from "./controllers/mentorTopicProgress.controller";
import QuizController from "./controllers/quiz.controller";
import TranslationController from "./controllers/translation.controller";
import WorksheetController from "./controllers/worksheet.controller";
import UserTopicProgress from "./controllers/userTopicProgress.controller";
import DashboardController from "./controllers/dashboard.controller";
import MentorAttachmentController from "./controllers/mentorAttachment.controller";
import ReportController from "./controllers/report.controller";
import ChallengeResponsesController from "./controllers/challenge_response.controller";


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
        new SupportTicketRepliesController,
        new CourseController,
        new FaqCategoryController,
        new FaqController,
        new MentorCourseController,
        new MentorTopicProgressController,
        new QuizController,
        new TranslationController,
        new WorksheetController,
        new UserTopicProgress,
        new DashboardController,
        new MentorAttachmentController,
        new ReportController,
        new ChallengeResponsesController

    ], Number(process.env.APP_PORT));
    // starting app
    app.listen();
} catch (error) {
    console.log(error);
}