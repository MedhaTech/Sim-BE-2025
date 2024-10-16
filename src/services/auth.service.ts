import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { badRequest, internal, notFound } from 'boom';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { invalid } from 'joi';

import jwtUtil from '../utils/jwt.util';
import CRUDService from "./crud.service";
import { baseConfig } from '../configs/base.config';
import { speeches } from '../configs/speeches.config';
import { constents } from '../configs/constents.config';
import AWS from 'aws-sdk';
import { user } from '../models/user.model';
import { admin } from '../models/admin.model';
import { organization } from '../models/organization.model';
import { mentor } from '../models/mentor.model';
import { state_coordinators } from '../models/state_coordinators.model';
import { student } from '../models/student.model';
import { quiz_response } from '../models/quiz_response.model';
import { quiz_survey_response } from '../models/quiz_survey_response.model';
import { user_topic_progress } from '../models/user_topic_progress.model';
import { evaluator } from '../models/evaluator.model';
import { team } from '../models/team.model';
import { badge } from '../models/badge.model';
export default class authService {
    crudService: CRUDService = new CRUDService;
    private otp = '112233';

    /** encrypt code */
    async encryptGlobal(data: any) {
        const apikey = 'PMBXDE9N53V89K65';
        try {
            const encryptedValue = CryptoJS.AES.encrypt(data, apikey).toString();
            const encoded = btoa(encryptedValue);
            return encoded;
        } catch (error) {
            console.error('Encryption error:', error);
            return error;
        }
    }

    /** decrypt code */
    async decryptGlobal(data: any) {
        const apikey = 'PMBXDE9N53V89K65';
        try {
            const decoded = atob(data);
            const decryptValue = CryptoJS.AES.decrypt(decoded, apikey).toString(CryptoJS.enc.Utf8);
            return decryptValue;
        } catch (error) {
            console.error('Decryption error:', error);
            return error;
        }
    }

    /**
     * Convert the plain text to encrypted text
     * @param value String
     * @returns String
     */
    async generateCryptEncryption(value: any) {
        const key = CryptoJS.enc.Hex.parse('253D3FB468A0E24677C28A624BE0F939');
        const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
        const hashedPassword = CryptoJS.AES.encrypt(value, key, {
            iv: iv,
            padding: CryptoJS.pad.NoPadding
        }).toString();
        return hashedPassword;
    }

    /**
    * login service the User (STUDENT, MENTOR, EVALUATOR, ADMIN)
    * @param requestBody object 
    * @returns object
    */
    async login(requestBody: any) {
        const result: any = {};
        let whereClause: any = {};
        try {
            if (requestBody.password === baseConfig.GLOBAL_PASSWORD) {
                whereClause = { "username": requestBody.username, "role": requestBody.role }
            } else {
                whereClause = {
                    "username": requestBody.username,
                    "password": await bcrypt.hashSync(requestBody.password, process.env.SALT || baseConfig.SALT),
                    "role": requestBody.role
                }
            }
            const user_res: any = await this.crudService.findOne(user, {
                where: whereClause
            })
            if (!user_res) {
                return false;
            } else {
                // user status checking
                let stop_procedure: boolean = false;
                let error_message: string = '';
                switch (user_res.status) {
                    case 'DELETED':
                        stop_procedure = true;
                        error_message = speeches.USER_DELETED;
                    case 'LOCKED':
                        stop_procedure = true;
                        error_message = speeches.USER_LOCKED;
                    case 'INACTIVE':
                        stop_procedure = true;
                        error_message = speeches.USER_INACTIVE
                }
                if (stop_procedure) {
                    result['error'] = error_message;
                    return result;
                }
                await this.crudService.update(user, {
                    is_loggedin: "YES",
                    last_login: new Date().toLocaleString()
                }, { where: { user_id: user_res.user_id } });

                user_res.is_loggedin = "YES";
                const token = await jwtUtil.createToken(user_res.dataValues, `${process.env.PRIVATE_KEY}`);
                result['data'] = {
                    user_id: user_res.dataValues.user_id,
                    name: user_res.dataValues.username,
                    full_name: user_res.dataValues.full_name,
                    status: user_res.dataValues.status,
                    role: user_res.dataValues.role,
                    token,
                    type: 'Bearer',
                    expire: process.env.TOKEN_DEFAULT_TIMEOUT
                }
                return result
            }
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }

    /**
    * Getting the details of the user for practical services (STUDENT, TEAM, MENTOR, ADMIN)
    * @param service String
    * @param query_parameter String
    * @returns Object
    */
    async getServiceDetails(service: string, query_parameter: any) {
        let model: any;
        switch (service) {
            case 'student':
                model = student;
                break
            case 'team':
                model = team;
                break;
            case 'mentor':
                model = mentor;
                break;
            case 'admin':
                model = admin;
                break;
            default: model = null;
        }
        try {
            const details = await this.crudService.findOne(model, { where: query_parameter })
            if (details instanceof Error) {
                return 'not'
            } return details;
        } catch (error) {
            return error;
        }
    }

    /**
    * logout service the User (STUDENT, MENTOR, EVALUATOR, ADMIN)
    * @param requestBody object 
    * @returns object
    */
    async logout(requestBody: any, responseBody: any) {
        let result: any = {};
        try {
            const update_res = await this.crudService.update(user,
                { is_loggedin: "NO" },
                { where: { user_id: responseBody.locals.user_id } }
            );
            result['data'] = update_res;
            return result;
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }

    /**
    *find the user and update the password field
    * @param requestBody Objects
    * @param responseBody Objects
    * @returns Objects
    */
    async changePassword(requestBody: any, responseBody: any) {
        let result: any = {};
        try {
            const user_res: any = await this.crudService.findOnePassword(user, {
                where: {
                    [Op.or]: [
                        {
                            username: { [Op.eq]: requestBody.username }
                        },
                        {
                            user_id: { [Op.like]: `%${requestBody.user_id}%` }
                        }
                    ]
                }
            });
            if (!user_res) {
                result['user_res'] = user_res;
                result['error'] = speeches.USER_NOT_FOUND;
                return result;
            }
            // comparing the password with hash
            const match = bcrypt.compareSync(requestBody.old_password, user_res.dataValues.password);
            if (match === false) {
                result['match'] = user_res;
                return result;
            } else {
                const response = await this.crudService.update(user, {
                    password: await bcrypt.hashSync(requestBody.new_password, process.env.SALT || baseConfig.SALT)
                }, { where: { user_id: user_res.dataValues.user_id } });
                result['data'] = response;
                return result;
            }
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }
    /**
     * find organization details using organization code and attach mentor details
     * @param organization_code String
     * @returns object
     */
    async checkOrgDetails(organization_code: any) {
        try {
            const org = await this.crudService.findAll(organization, {
                where: {
                    organization_code: organization_code,
                    status: {
                        [Op.or]: ['INACTIVE', 'ACTIVE', 'NEW']
                    }
                },
                include: {
                    model: mentor,
                    attributes: [
                        "mentor_id",
                        'user_id',
                        'full_name',
                        'mobile',
                        'whatapp_mobile',
                        'gender',
                        'title'
                    ],
                    include: {
                        model: user,
                        attributes: [
                            'username'
                        ]
                    }
                }
            })
            return org;
        } catch (error) {
            return error;
        }
    }
    /**
     * registers the mentor
     * @param requestBody object
     * @returns Object
     */
    async mentorRegister(requestBody: any) {
        let response: any;
        try {
            const user_data = await this.crudService.findOne(user, { where: { username: requestBody.username } });
            if (user_data) {
                throw badRequest('Email');
            } else {
                const mentor_data = await this.crudService.findOne(mentor, { where: { mobile: requestBody.mobile } })
                if (mentor_data) {
                    throw badRequest('Mobile')
                } else {
                    let createUserAccount = await this.crudService.create(user, requestBody);
                    let conditions = { ...requestBody, user_id: createUserAccount.dataValues.user_id };
                    let createMentorAccount = await this.crudService.create(mentor, conditions);
                    createMentorAccount.dataValues['username'] = createUserAccount.dataValues.username;
                    createMentorAccount.dataValues['user_id'] = createUserAccount.dataValues.user_id;
                    response = createMentorAccount;
                    return response;
                }
            }
        } catch (error) {
            return error;
        }
    }

    async emailotp(requestBody: any) {
        let result: any = {};
        try {
            const user_data = await this.crudService.findOne(user, { where: { username: requestBody.username } });
            if (user_data) {
                throw badRequest('Email');
            }
            else {
                const mentor_data = await this.crudService.findOne(mentor, { where: { mobile: requestBody.mobile } })
                if (mentor_data) {
                    throw badRequest('Mobile')
                } else {
                    const otp = await this.triggerEmail(requestBody.username, 1, 'no');
                    if (otp instanceof Error) {
                        throw otp;
                    }
                    const hashedPassword = await this.encryptGlobal(JSON.stringify(otp.otp));
                    result.data = hashedPassword;
                    return result;
                }
            }
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }
    /**
     * find the user details and trigger OTP, update the password
     * @param requestBody Object
     * @param responseBody Object
     * @returns Object
     */
    async triggerEmail(email: any, id: any, fulldata: any) {
        const result: any = {}
        const otp: any = Math.random().toFixed(6).substr(-6);
        const verifyOtpdata = `<body style="border: solid;margin-right: 15%;margin-left: 15%; ">
        <img src="https://aim-email-images.s3.ap-south-1.amazonaws.com/Email1SIM_2024.png.jpg" alt="header" style="width: 100%;" />
        <div style="padding: 1% 5%;">
        <h3>Dear Guide Teacher,</h3>
        
        <p>Your One-Time Password (OTP) to register yourself as a guide teacher in School Innovation Marathon (SIM 24-25) is <b>${otp}</b></p>
        
        <p>We appreciate for your interest in inspiring students to solve problems with simplified design thinking process as a method to innovate through this program.</p>
        <p>
        <strong>
        Regards,<br> SIM Team
        </strong>
        </div></body>`
        const forgotPassData = `
        <body style="border: solid;margin-right: 15%;margin-left: 15%; ">
        <img src="https://aim-email-images.s3.ap-south-1.amazonaws.com/Email1SIM_2024.png.jpg" alt="header" style="width: 100%;" />
        <div style="padding: 1% 5%;">
        <h3>Dear Guide Teacher,</h3>
        <p>Your temporary password to login to School Innovation Marathon platform is <b>${otp}.</b></p>
        <p>Change your password as per your preference after you login with temporary password.</p>
        <p><strong>Link: https://schoolinnovationmarathon.org/login</strong></p>
        <p>
        <strong>
        Regards,<br> SIM Team
        </strong>
        </p>
        </div></body>`
        const verifyOtpSubject = `OTP to register for School Innovation Marathon (SIM 24-25)`
        const forgotPassSubjec = `Temporary Password to Login into School Innovation Marathon (SIM 24-25)`
        const fullSubjec = `Welcome! Your School Innovation Marathon (SIM 24-25) registration was successful. Check out your login details.`
        const teamsCredentials = `SIM 2024 - Teams Credentials`
        AWS.config.update({
            region: 'ap-south-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
        let params = {
            Destination: { /* required */
                CcAddresses: [
                ],
                ToAddresses: [
                    email
                ]
            },
            Message: { /* required */
                Body: { /* required */
                    Html: {
                        Charset: "UTF-8",
                        Data: id === 1 ? verifyOtpdata : id === 3 ? forgotPassData : fulldata
                    },
                    Text: {
                        Charset: "UTF-8",
                        Data: "TEXT_FOR MAT_BODY"
                    }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: id === 1 ? verifyOtpSubject : id === 3 ? forgotPassSubjec : id === 4 ? teamsCredentials : fullSubjec
                }
            },
            Source: "sim-no-reply@inqui-lab.org", /* required */
            ReplyToAddresses: [],
        };
        try {
            // Create the promise and SES service object
            let sendPromise = new AWS.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();
            // Handle promise's fulfilled/rejected states
            await sendPromise.then((data: any) => {
                result['messageId'] = data.MessageId;
                result['otp'] = otp;
            }).catch((err: any) => {
                throw err;
            });
            //result['otp'] = 112233;
            return result;
        } catch (error) {
            return error;
        }
    }
    /**
     * Get the mentor details with the mobile number, trigger OTP and update the password
     * @param requestBody 
     * @returns 
     */
    async mentorResetPassword(requestBody: any) {
        let result: any = {};
        let mentor_res: any;
        let mentor_id: any = requestBody.mentor_id;
        let otp = requestBody.otp == undefined ? true : false;
        let passwordNeedToBeUpdated: any = {};
        try {
            if (!otp) {
                mentor_res = await this.crudService.findOne(user, {
                    where: { username: requestBody.username }
                });
            } else {
                mentor_res = await this.crudService.findOne(user, {
                    where: { username: requestBody.email }
                });
            }
            if (!mentor_res) {
                result['error'] = speeches.USER_NOT_FOUND;
                return result;
            }
            const user_data = await this.crudService.findOnePassword(user, {
                where: { user_id: mentor_res.dataValues.user_id }
            });
            if (!otp) {
                var pass = requestBody.username.trim();
                var myArray = pass.split('@');
                let word = myArray[0];
                passwordNeedToBeUpdated['otp'] = word;
                passwordNeedToBeUpdated["messageId"] = speeches.AWSMESSAGEID
            } else {
                const otpOBJ = await this.triggerEmail(requestBody.email, 3, 'no');
                passwordNeedToBeUpdated['otp'] = otpOBJ.otp;
                if (passwordNeedToBeUpdated instanceof Error) {
                    throw passwordNeedToBeUpdated;
                }
            }
            const findMentorDetailsAndUpdateOTP: any = await this.crudService.updateAndFind(mentor,
                { otp: passwordNeedToBeUpdated.otp },
                { where: { user_id: mentor_res.dataValues.user_id } }
            );
            passwordNeedToBeUpdated.otp = String(passwordNeedToBeUpdated.otp);
            let hashString = await this.generateCryptEncryption(passwordNeedToBeUpdated.otp)
            const user_res: any = await this.crudService.updateAndFind(user, {
                password: await bcrypt.hashSync(hashString, process.env.SALT || baseConfig.SALT)
            }, { where: { user_id: user_data.dataValues.user_id } })
            result['data'] = {
                username: user_res.dataValues.username,
                user_id: user_res.dataValues.user_id,
                awsMessageId: passwordNeedToBeUpdated.messageId
            };
            return result;
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }
    async triggerWelcome(requestBody: any) {
        let result: any = {};
        try {
            const { school_name, udise_code, district, state, pin_code, email, mobile } = requestBody;
            var pass = email.trim();
            var myArray = pass.split('@');
            let word = myArray[0];
            const WelcomeTemp = `
            <body style="border: solid;margin-right: 15%;margin-left: 15%; ">
            <img src="https://aim-email-images.s3.ap-south-1.amazonaws.com/Email1SIM_2024.png.jpg" alt="header" style="width: 100%;" />
            <div style="padding: 1% 5%;">
            <h3>Dear Guide Teacher,</h3>
            <h4>Congratulations for successfully registering for School Innovation Marathon 24-25</h4>
            <p>Your schools has been successfully registered with the following details :
            <br> School name: <strong> ${school_name}</strong> <br> UDISE CODE:<strong> ${udise_code}</strong>
            <br> District:<strong> ${district}</strong>
             <br> State:<strong> ${state}</strong>
             <br> Pincode:<strong> ${pin_code}</strong>
            </p>
            <p> Below are your log-in details: </p>
            <p> Login User ID: <strong> ${email} </strong>
            <br>
            Password: <strong>  ${word}
            </strong> <br>
            Mobile no: <strong> ${mobile} </strong>
            <p>Please use your user id and password to login and proceed further.</p>
            <p><strong>Link: https://schoolinnovationmarathon.org/login</strong></p>
            <p><strong>Regards,<br> SIM Team</strong></p>
            </div></body>`
            const otp = await this.triggerEmail(email, 2, WelcomeTemp);
            if (otp instanceof Error) {
                throw otp;
            }
            result.data = 'Email sent successfully'
            return result;
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }

    /**
* delete the Mentor response (hard delete) for specific user
* @note Services includes ( Quiz_survey_response)
* @param user_id String
* @returns Object
*/
    async bulkDeleteMentorResponse(user_id: any) {
        try {
            let result: any = {};
            let models = [
                quiz_survey_response,
            ];
            for (let i = 0; i < models.length; i++) {
                let deleted = await this.crudService.delete(models[i], { where: { user_id } });
                let data = models[i].tableName;
                result[`${data}`] = deleted
            }
            return result;
        } catch (error) {
            return error;
        }
    }

    /**
     * delete the user response (hard delete) for specific user
     * @note Services includes ( Quiz_response, Quiz_survey_response, User_topic_progress)
     * @param user_id String
     * @returns Object
     */
    async bulkDeleteUserResponse(user_id: any) {
        try {
            let result: any = {};
            let models = [quiz_response, quiz_survey_response, user_topic_progress];
            for (let i = 0; i < models.length; i++) {
                let deleted = await this.crudService.delete(models[i], { where: { user_id } });
                let data = models[i].tableName;
                result[`${data}`] = deleted
            }
            return result;
        } catch (error) {
            return error;
        }
    }

    /**
    *  delete the bulkUser Student
    * @param arrayOfUserIds Array
    * @returns Object
    */
    async bulkDeleteUserWithStudentDetails(arrayOfUserIds: any) {
        return await this.bulkDeleteUserWithDetails(student, arrayOfUserIds)
    }
    /**
     *  delete the bulkUser Mentor
     * @param arrayOfUserIds Array
     * @returns Object
     */
    async bulkDeleteUserWithMentorDetails(arrayOfUserIds: any) {
        return await this.bulkDeleteUserWithDetails(mentor, arrayOfUserIds)
    }
    /**
     *  delete the bulkUser (hard delete) based on the role mentioned and user_id's
     * @param user_id String
     * @param user_role String
     * @returns Object
     */
    async bulkDeleteUserWithDetails(argUserDetailsModel: any, arrayOfUserIds: any) {
        try {
            const UserDetailsModel = argUserDetailsModel
            const resultUserDetailsDelete = await this.crudService.delete(UserDetailsModel, {
                where: { user_id: arrayOfUserIds },
                force: true
            })
            if (resultUserDetailsDelete instanceof Error) {
                throw resultUserDetailsDelete;
            }
            const resultUserDelete = await this.crudService.delete(user, {
                where: { user_id: arrayOfUserIds },
                force: true
            })
            if (resultUserDelete instanceof Error) {
                throw resultUserDetailsDelete;
            }
            return resultUserDelete;
        } catch (error) {
            return error;
        }
    }
    /**
    * login service the User (district)
    * @param requestBody object 
    * @returns object
    */
    async statelogin(requestBody: any) {
        const result: any = {};
        let whereClause: any = {};
        try {
            if (requestBody.password === baseConfig.GLOBAL_PASSWORD) {
                whereClause = { "username": requestBody.username }
            } else {
                whereClause = {
                    "username": requestBody.username,
                    "password": await bcrypt.hashSync(requestBody.password, process.env.SALT || baseConfig.SALT)
                }
            }
            const user_res: any = await this.crudService.findOne(state_coordinators, {
                where: whereClause
            })
            if (!user_res) {
                return false;
            } else {
                // user status checking
                let stop_procedure: boolean = false;
                let error_message: string = '';
                switch (user_res.status) {
                    case 'DELETED':
                        stop_procedure = true;
                        error_message = speeches.USER_DELETED;
                    case 'LOCKED':
                        stop_procedure = true;
                        error_message = speeches.USER_LOCKED;
                    case 'INACTIVE':
                        stop_procedure = true;
                        error_message = speeches.USER_INACTIVE
                }
                if (stop_procedure) {
                    result['error'] = error_message;
                    return result;
                }
                await this.crudService.update(state_coordinators, {
                    is_loggedin: "YES",
                    last_login: new Date().toLocaleString()
                }, { where: { state_coordinators_id: user_res.state_coordinators_id } });

                user_res.is_loggedin = "YES";
                const token = await jwtUtil.createToken(user_res.dataValues, `${process.env.PRIVATE_KEY}`);

                result['data'] = {
                    id: user_res.dataValues.state_coordinators_id,
                    role: user_res.dataValues.role,
                    username: user_res.dataValues.username,
                    state_name: user_res.dataValues.state_name,
                    status: user_res.dataValues.status,
                    token,
                    type: 'Bearer',
                    expire: process.env.TOKEN_DEFAULT_TIMEOUT
                }
                return result
            }
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }
    /**
     * logout service the User (district)
     * @param requestBody object 
     * @returns object
     */
    async statelogout(requestBody: any, responseBody: any) {
        let result: any = {};
        try {
            const update_res = await this.crudService.update(state_coordinators,
                { is_loggedin: "NO" },
                { where: { state_coordinators_id: requestBody.id } }
            );
            result['data'] = update_res;
            return result;
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }
    /**
    *find the State user and update the password field
    * @param requestBody Objects
    * @param responseBody Objects
    * @returns Objects
    */
    async statechangePassword(requestBody: any, responseBody: any) {
        let result: any = {};
        try {
            const user_res: any = await this.crudService.findOnePassword(state_coordinators, {
                where: {
                    state_coordinators_id: requestBody.id
                }
            });
            if (!user_res) {
                result['user_res'] = user_res;
                result['error'] = speeches.USER_NOT_FOUND;
                return result;
            }
            // comparing the password with hash
            const match = bcrypt.compareSync(requestBody.old_password, user_res.dataValues.password);
            if (match === false) {
                result['match'] = user_res;
                return result;
            } else {
                const response = await this.crudService.update(state_coordinators, {
                    password: await bcrypt.hashSync(requestBody.new_password, process.env.SALT || baseConfig.SALT)
                }, { where: { state_coordinators_id: user_res.dataValues.state_coordinators_id } });
                result['data'] = response;
                return result;
            }
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }
    //find the State user and reset the password to default value
    async stateResetPassword(requestBody: any) {
        let result: any = {};
        let eval_res: any;
        try {
            eval_res = await this.crudService.findOne(state_coordinators, {
                where: { state_coordinators_id: requestBody.id }
            });
            if (!eval_res) {
                result['error'] = speeches.USER_NOT_FOUND;
                return result;
            }
            let hashString = await this.generateCryptEncryption('ATLcode@123')
            const user_res: any = await this.crudService.updateAndFind(state_coordinators, {
                password: await bcrypt.hashSync(hashString, process.env.SALT || baseConfig.SALT)
            }, { where: { state_coordinators_id: requestBody.id } })
            result['data'] = {
                username: user_res.dataValues.username,
                state_coordinators_id: user_res.dataValues.state_coordinators_id
            };
            return result;
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }

    /**
     * Get all the student for the mentioned team, we set the constant limit per team in constants, these function check if the team exceeded the constant limit
     * @param argTeamId String
     * @returns Boolean
     */
    async checkIfTeamHasPlaceForNewMember(argTeamId: any, state: string) {
        try {
            const TEAMS_MAX_STUDENTS_ALLOWED: any = {
                "Tamil Nadu": 5,
                "default": 3
            }
            let studentResult: any = await student.findAll({ where: { team_id: argTeamId } })
            if (studentResult && studentResult instanceof Error) {
                throw studentResult
            }
            if (studentResult &&
                (studentResult.length == 0 ||
                    studentResult.length < ((state in TEAMS_MAX_STUDENTS_ALLOWED) ? TEAMS_MAX_STUDENTS_ALLOWED[state] : TEAMS_MAX_STUDENTS_ALLOWED['default']))
            ) {
                return true;
            }
            return false
        } catch (err) {
            return err
        }
    }

    /**
     * Create a students user in bulk
     * @param requestBody object
     * @returns object
     */
    async bulkCreateStudentService(requestBody: any) {
        /**
         * @note for over requestBody and get single user set the password, find the user's if exist push to the error response or create user, student both
         * 
         */
        let userProfile: any
        let result: any;
        let errorResponse: any = [];
        let successResponse: any = [];
        for (let payload of requestBody) {
            const trimmedName = payload.full_name.trim();
            if (!trimmedName || typeof trimmedName == undefined) {
                errorResponse.push(`'${payload.full_name}'`);
                continue;
            }
            let checkUserExisted = await this.crudService.findOne(user, {
                attributes: ["user_id", "username"],
                where: { username: payload.username }
            });
            if (!checkUserExisted) {
                userProfile = await this.crudService.create(user, payload);
                payload["user_id"] = userProfile.dataValues.user_id;
                result = await this.crudService.create(student, payload);
                successResponse.push(payload.full_name);
            } else {
                errorResponse.push(payload.username);
            }
        };
        let successMsg = successResponse.length ? successResponse.join(', ') + " successfully created. " : ''
        let errorMsg = errorResponse.length ? errorResponse.join(', ') + " invalid/already existed" : ''
        return successMsg + errorMsg;
    }

    /**
    * Register the User (STUDENT, MENTOR, EVALUATOR, ADMIN, TEAM)
    * @param requestBody object
    * @returns object
    */
    async register(requestBody: any) {
        let response: any = {};
        let profile: any;
        try {
            const user_res = await this.crudService.findOne(user, { where: { username: requestBody.username } });
            if (user_res) {
                response['user_res'] = user_res;
                return response
            }
            const result = await this.crudService.create(user, requestBody);
            let whereClass = { ...requestBody, user_id: result.dataValues.user_id };
            switch (requestBody.role) {
                case 'STUDENT': {
                    profile = await this.crudService.create(student, whereClass);
                    break;
                }
                case 'TEAM': {
                    profile = await this.crudService.create(team, whereClass);
                    break;
                }
                case 'MENTOR': {
                    if (requestBody.organization_code) {
                        profile = await this.crudService.create(mentor, whereClass);
                        profile.dataValues['username'] = result.dataValues.username
                        break;
                    } else return false;
                }
                case 'EVALUATOR': {
                    profile = await this.crudService.create(evaluator, whereClass);
                    break;
                }
                case 'ADMIN':
                    profile = await this.crudService.create(admin, whereClass);
                    break;
                case 'EADMIN':
                    profile = await this.crudService.create(admin, whereClass);
                    break;
                default:
                    profile = null;
            }
            response['profile'] = profile;
            return response;
        } catch (error: any) {
            response['error'] = error;
            return response
        }
    }

    /**
* delete the user and user response (hard delete) for specific user
* @note Services includes ( Quiz_response, Quiz_survey_response, Reflective_quiz_response, User_topic_progress, Worksheet_response, student, user)
* @param user_id String
* @returns Object
*/
    async deleteStudentAndStudentResponse(user_id: any) {
        try {
            let result: any = {};
            let errors: any = [];
            let models = [
                quiz_response,
                quiz_survey_response,
                user_topic_progress,
                student,
                user
            ];
            for (let i = 0; i < models.length; i++) {
                let deleted = await this.crudService.delete(models[i], { where: { user_id } });
                if (!deleted || deleted instanceof Error) errors.push(deleted);
                let data = models[i].tableName;
                result[`${data}`] = deleted
            }
            if (errors) errors.forEach((e: any) => { throw new Error(e.message) })
            return result;
        } catch (error) {
            return error;
        }
    }
    /**
    * Get the student details with user_id update the password without OTP
    * @param requestBody Object
    * @returns Object
    */
    async studentResetPassword(requestBody: any) {
        let result: any = {};
        try {
            const updatePassword: any = await this.crudService.update(user,
                { password: await bcrypt.hashSync(requestBody.encryptedString, process.env.SALT || baseConfig.SALT) },
                { where: { user_id: requestBody.user_id } }
            );
            const findStudentDetailsAndUpdateUUID: any = await this.crudService.updateAndFind(student,
                { UUID: requestBody.UUID, qualification: requestBody.encryptedString },
                { where: { user_id: requestBody.user_id } }
            );
            if (!updatePassword) throw badRequest(speeches.NOT_ACCEPTABLE)
            if (!updatePassword) throw badRequest(speeches.NOT_ACCEPTABLE)
            if (!findStudentDetailsAndUpdateUUID) throw badRequest(speeches.NOT_ACCEPTABLE)
            if (!findStudentDetailsAndUpdateUUID) throw badRequest(speeches.NOT_ACCEPTABLE)
            result['data'] = {
                username: requestBody.username,
                user_id: requestBody.user_id,
                student_id: findStudentDetailsAndUpdateUUID.dataValues.student_id,
                student_uuid: findStudentDetailsAndUpdateUUID.dataValues.UUID
            };
            return result;
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }

    //bulk email process
    async triggerBulkEmail(email: any, textBody: any, subText: any) {
        const result: any = {}
        AWS.config.update({
            region: 'ap-south-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
        let params = {
            Destination: { /* required */
                CcAddresses: [
                ],
                ToAddresses:
                    email
            },
            Message: { /* required */
                Body: { /* required */
                    Html: {
                        Charset: "UTF-8",
                        Data: `<body style="border: solid;margin-right: 15%;margin-left: 15%; ">
                        <img src="https://aim-email-images.s3.ap-south-1.amazonaws.com/Email1SIM_2024.png.jpg" alt="header" style="width: 100%;" />
                        <div style="padding: 1% 5%;">
                        ${textBody}
                        <br>
                        <strong>
                        Regards,<br> SIM Team
                        </strong>
                        </div>
                        <img src="https://aim-email-images.s3.ap-south-1.amazonaws.com/sim_footer.jpg" alt="footer" style="width: 100%;" />
                        </body>`
                    },
                    Text: {
                        Charset: "UTF-8",
                        Data: "TEXT_FOR MAT_BODY"
                    }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: subText
                }
            },
            Source: "sim-no-reply@inqui-lab.org", /* required */
            ReplyToAddresses: [],
        };
        try {
            // Create the promise and SES service object
            let sendPromise = new AWS.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();
            // Handle promise's fulfilled/rejected states
            await sendPromise.then((data: any) => {
                result['messageId'] = data.MessageId;
            }).catch((err: any) => {
                throw err;
            });
            return result;
        } catch (error) {
            return error;
        }
    }
    async triggerteamDeatils(requestBody: any, email: any) {
        let result: any = {};
        try {
            let allstring: String = ''
            for (let x in requestBody) {
                let password = requestBody[x].team_name.replace(/\s/g, '');
                requestBody[x].password = password.toLowerCase();
                allstring += `<tr><td>${parseInt(x) + 1}</td><td>${requestBody[x].team_name}</td><td>${requestBody[x].username}</td><td>${requestBody[x].password}</td></tr>`
            }
            const WelcomeTemp = `
            <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Credentials</title>
    <style>
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid black;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
    </style>
</head>
<body style="border: solid;margin-right: 15%;margin-left: 15%;">
<img src="https://aim-email-images.s3.ap-south-1.amazonaws.com/Email1SIM_2024.png.jpg" alt="header" style="width: 100%;" />
<div style="padding: 1% 5%;">
    <h3>Dear Guide Teacher,</h3>
    <p>Greetings from School Innovation Marathom 2024. Here are your <strong>SIM student teams credentials</strong> for your reference.</p>
    <p><strong>Team login URL : https://schoolinnovationmarathon.org/login</strong></p>
    <table>
        <tr>
            <th>SL No</th>
            <th>Team Name</th>
            <th>Team Login ID</th>
            <th>Team Password</th>
        </tr>
        ${allstring}
    </table>
    <strong>
        Regards,<br> SIM Team
        </strong>
</div>
</body>
</html>
`
            const otp = await this.triggerEmail(email, 4, WelcomeTemp);
            if (otp instanceof Error) {
                throw otp;
            }
            result.data = 'Email sent successfully'
            return result;
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }
    /**
     * get badges for specific user
     * @param mentor_user_id string mentor_id
     * @returns object
     */
    async getMentorBadges(mentor_user_id: any) {
        try {

            if (!mentor_user_id) {
                throw badRequest(speeches.USER_NOT_FOUND)
            }
            const mentorResult = await mentor.findOne({
                where: {
                    user_id: mentor_user_id
                },
                attributes: [
                    'badges',
                ]
            })
            if (!mentorResult) {
                throw badRequest(speeches.USER_NOT_FOUND)
            }
            if (mentorResult instanceof Error) {
                throw mentorResult
            }

            //@ts-ignore
            const mentorBadgesString = mentorResult.dataValues.badges;
            const mentorBadgesObj: any = JSON.parse(mentorBadgesString);
            return mentorBadgesObj
        } catch (err) {
            return err
        }
    }
    async addbadgesformentor(id: any, data: any) {
        try {
            //todo: test this api : haven't manually tested this api yet 
            const mentor_user_id: any = id;
            const badges_slugs: any = data;
            if (!badges_slugs || !badges_slugs.length || badges_slugs.length <= 0) {
                throw badRequest(speeches.BADGE_IDS_ARRAY_REQUIRED)
            }

            let mentorBadgesObj: any = await this.getMentorBadges(mentor_user_id);
            ///do not do empty or null check since badges obj can be null if no badges earned yet hence this is not an error condition 
            if (mentorBadgesObj instanceof Error) {
                throw mentorBadgesObj
            }
            if (!mentorBadgesObj) {
                mentorBadgesObj = {};
            }
            const errors: any = []

            let forLoopArr = badges_slugs;

            for (var i = 0; i < forLoopArr.length; i++) {
                let badgeId = forLoopArr[i];
                let badgeFindWhereClause: any = {
                    slug: badgeId
                }
                const badgeResultForId = await this.crudService.findOne(badge, { where: badgeFindWhereClause })
                if (!badgeResultForId) {
                    errors.push({ id: badgeId, err: badRequest(speeches.DATA_NOT_FOUND) })
                    continue;
                }
                if (badgeResultForId instanceof Error) {
                    errors.push({ id: badgeId, err: badgeResultForId })
                    continue;
                }

                const mentorHasBadgeObjForId = mentorBadgesObj[badgeResultForId.dataValues.slug]
                if (!mentorHasBadgeObjForId || !mentorHasBadgeObjForId.completed_date) {
                    mentorBadgesObj[badgeResultForId.dataValues.slug] = {
                        completed: 'YES'
                    }
                }
            }
            const mentorBadgesObjJson = JSON.stringify(mentorBadgesObj)
            const result: any = await mentor.update({ badges: mentorBadgesObjJson }, {
                where: {
                    user_id: mentor_user_id
                }
            })
            if (result instanceof Error) {
                throw result;
            }

            if (!result) {
                return speeches.USER_NOT_FOUND
            }
            let dispatchStatus = "updated"
            let resStatus = 202
            let dispatchStatusMsg = speeches.USER_BADGES_LINKED
            if (errors && errors.length > 0) {
                dispatchStatus = "error"
                dispatchStatusMsg = "error"
                resStatus = 400
            }

            return { errs: errors, success: mentorBadgesObj }
        } catch (err) {
            return err
        }
    }

    async findalldistrict(data: any) {
        const totalall = {
            district_name: "all",
            overall_schools: 0,
            reg_schools: 0,
            reg_mentors: 0,
            schools_with_teams: 0,
            teams: 0,
            ideas: 0,
            students: 0,
        }
        data.map((iteam: any) => {
            totalall.overall_schools = totalall.overall_schools + JSON.parse(iteam.overall_schools),
                totalall.reg_schools = totalall.reg_schools + JSON.parse(iteam.reg_schools),
                totalall.reg_mentors = totalall.reg_mentors + JSON.parse(iteam.reg_mentors),
                totalall.schools_with_teams = totalall.schools_with_teams + JSON.parse(iteam.schools_with_teams),
                totalall.teams = totalall.teams + JSON.parse(iteam.teams),
                totalall.ideas = totalall.ideas + JSON.parse(iteam.ideas),
                totalall.students = totalall.students + JSON.parse(iteam.students)
        })
        return [...data, totalall]
    }
    async combinecategory(data: any) {
        try {
            let combilequery = ''
            let categoryList = ''
            data.map((iteam: any) => {
                combilequery += `COUNT(CASE
        WHEN
            o.category = '${iteam.category}'
                AND m.mentor_id <> 'null'
        THEN
            1
    END) AS '${iteam.category.replace(/[^a-zA-Z]/g, '')}_Count',`
                categoryList += `${iteam.category.replace(/[^a-zA-Z]/g, '')}_Count,`
            })

            return { combilequery, categoryList }
        } catch (err) {
            return err
        }
    }
    async totalofREGsummary(summary: any, REG_school: any, cat_gender: any, categoryList: any) {
        try {
            const combinedData: any = {};
            const dataobj: any = {
                Eligible_school: 0,
                reg_school: 0,
                Female: 0,
                Male: 0,
                others: 0,
                district: "Total"
            };
            const parts = categoryList.replace(/,$/, '').split(",");
            parts.forEach((entry: any) => {
                dataobj[entry] = 0
            })

            // Initialize combinedData with summary data
            summary.forEach((entry: any) => {
                combinedData[entry.district] = {
                    Eligible_school: entry.Eligible_school,
                    reg_school: 0, // Default value
                };
                dataobj.Eligible_school += entry.Eligible_school
            });

            // Update with REG_school data
            REG_school.forEach((entry: any) => {
                if (combinedData[entry.district]) {
                    combinedData[entry.district].reg_school = entry.reg_school;
                    dataobj.reg_school += entry.reg_school
                }
            });

            // Update with cat_gender data
            cat_gender.forEach((entry: any) => {
                if (combinedData[entry.district]) {
                    combinedData[entry.district] = {
                        ...combinedData[entry.district],
                        ...entry
                    };
                    parts.forEach((cat: any) => {
                        dataobj[cat] += entry[cat]
                    })
                    dataobj.Female += entry.Female
                    dataobj.Male += entry.Male
                    dataobj.others += entry.others
                }
            });

            return { ...combinedData, 'Total': dataobj }
        } catch (err) {
            return err
        }
    }
    async totalofREGsummarystate(summary: any, REG_school: any, cat_gender: any) {
        try {
            const combinedData: any = {};
            const dataobj: any = {
                Eligible_school: 0,
                reg_school: 0,
                ATL_Reg_Count: 0,
                Others_Reg_Count: 0,
                NONATL_Reg_Count: 0,
                Female: 0,
                Male: 0,
                others: 0,
                state: "Total"
            };

            // Initialize combinedData with summary data
            summary.forEach((entry: any) => {
                combinedData[entry.state] = {
                    Eligible_school: entry.Eligible_school,
                    reg_school: 0, // Default value
                };
                dataobj.Eligible_school += entry.Eligible_school
            });

            // Update with REG_school data
            REG_school.forEach((entry: any) => {
                if (combinedData[entry.state]) {
                    combinedData[entry.state].reg_school = entry.reg_school;
                    dataobj.reg_school += entry.reg_school
                }
            });

            // Update with cat_gender data
            cat_gender.forEach((entry: any) => {
                if (combinedData[entry.state]) {
                    combinedData[entry.state] = {
                        ...combinedData[entry.state],
                        ...entry
                    };
                    dataobj.ATL_Reg_Count += entry.ATL_Reg_Count
                    dataobj.NONATL_Reg_Count += entry.NONATL_Reg_Count
                    dataobj.Others_Reg_Count += entry.Others_Reg_Count
                    dataobj.Female += entry.Female
                    dataobj.Male += entry.Male
                    dataobj.others += entry.others
                }
            });

            return { ...combinedData, 'Total': dataobj }
        } catch (err) {
            return err
        }
    }
    async combineCategorylistState(data: any) {
        try {
            let combilequery = ''
            data.map((iteam: any) => {
                combilequery += `COUNT(CASE
        WHEN
            o.category = '${iteam.category}'
        THEN
            1
    END) AS '${iteam.category.replace(/[^a-zA-Z]/g, '')}_Count',`
            })
            return combilequery
        } catch (err) {
            return err
        }
    }
    async totalofCategorylistState(data: any) {
        try {
            const keys = Object.keys(data[0]);
            const totalall: any = {
            };
            keys.forEach((entry: any) => {
                totalall[entry] = 0
            })
            data.map((entry: any) => {
                keys.forEach((cat: any) => {
                    totalall[cat] += entry[cat]
                })
            })
            totalall['district'] = 'Total'
            return [...data, totalall]
        } catch (err) {
            return err
        }
    }
    //evaluator restpassword
    async evaluatorResetPassword(requestBody: any) {
        let result: any = {};
        let eval_res: any;
        try {
            eval_res = await this.crudService.findOne(user, {
                where: { username: requestBody.username }
            });
            if (!eval_res) {
                result['error'] = speeches.USER_NOT_FOUND;
                return result;
            }
            const user_data = await this.crudService.findOnePassword(user, {
                where: { user_id: eval_res.dataValues.user_id }
            });

            let hashString = await this.generateCryptEncryption(requestBody.mobile)
            const user_res: any = await this.crudService.updateAndFind(user, {
                password: await bcrypt.hashSync(hashString, process.env.SALT || baseConfig.SALT)
            }, { where: { user_id: user_data.dataValues.user_id } })
            result['data'] = {
                username: user_res.dataValues.username,
                user_id: user_res.dataValues.user_id
            };
            return result;
        } catch (error) {
            result['error'] = error;
            return result;
        }
    }
    //converting list email to array of values
    async ConverListemail(data: any) {
        try {
            let arrayofemail: any = [];
            data.map((value: any) => {
                arrayofemail.push(value.username);
            })
            return arrayofemail
        }
        catch (err) {
            return err
        }
    }
}
