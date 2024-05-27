import "dotenv/config";
import validateEnv from "./utils/validate_env";
import App from "./app";

import AdminController from "./controllers/admin.controller";
import OrganizationController from "./controllers/organization.controller";
import MentorController from "./controllers/mentor.controller";


// validating env variables
validateEnv();

try {
    // initializing app
    const app = new App([
        new AdminController,
        new OrganizationController,
        new MentorController
    ], Number(process.env.APP_PORT));
    // starting app
    app.listen();
} catch (error) {
    console.log(error);
}