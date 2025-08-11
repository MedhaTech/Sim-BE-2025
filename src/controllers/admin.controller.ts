import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { speeches } from '../configs/speeches.config';
import dispatcher from '../utils/dispatch.util';
import authService from '../services/auth.service';
import BaseController from './base.controller';
import ValidationsHolder from '../validations/validationHolder';
import { user } from '../models/user.model';
import { admin } from '../models/admin.model';
import { adminbulkemail, adminSchema, adminUpdateSchema } from '../validations/admins.validationa';
import { badRequest, notFound, unauthorized } from 'boom';
import validationMiddleware from '../middlewares/validation.middleware';
import { email } from '../models/email.model';
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { BlobServiceClient } from "@azure/storage-blob";
import nodemailer from "nodemailer";

export default class AdminController extends BaseController {
    model = "admin";
    authService: authService = new authService;

    protected initializePath(): void {
        this.path = '/admins';
    }
    protected initializeValidations(): void {
        this.validations = new ValidationsHolder(adminSchema, adminUpdateSchema);
    }
    protected initializeRoutes(): void {

        this.router.post(`${this.path}/login`, this.login.bind(this));
        this.router.get(`${this.path}/logout`, this.logout.bind(this));
        this.router.put(`${this.path}/changePassword`, this.changePassword.bind(this));
        this.router.get(`${this.path}/knowqueryparm`, this.getknowqueryparm.bind(this));
        this.router.post(`${this.path}/createqueryparm`, this.getcreatequeryparm.bind(this));
        this.router.post(`${this.path}/encryptedPassword`, this.encryptedPassword.bind(this));
        this.router.post(`${this.path}/bulkEmail`, validationMiddleware(adminbulkemail), this.bulkEmail.bind(this));
        this.router.get(`${this.path}/s3fileaccess`, this.gets3fileaccess.bind(this));
        this.router.post(`${this.path}/newfileuplad`, this.newfileuplad.bind(this));
        this.router.post(`${this.path}/newEmailservice`, this.newEmailservice.bind(this));
        super.initializeRoutes();
    }
    //Creating Admin & Eadmin users
    protected async createData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (!req.body.username || req.body.username === "") req.body.username = req.body.full_name.replace(/\s/g, '');
        if (!req.body.password || req.body.password === "") req.body.password = await this.authService.generateCryptEncryption(req.body.username);
        if (req.body.role == 'ADMIN' || req.body.role == 'EADMIN') {
            if (res.locals.role !== 'ADMIN') {
                req.body.role = "Dashboard,Overall Schools,PopUp,Resource,Latest News,State Specific,Support,Mentors,Teams,Students,Admins,States,Reports,Bulk Email"
            }
            const payload = this.autoFillTrackingColumns(req, res, admin);
            const result = await this.authService.register(payload);
            if (result.user_res) return res.status(406).send(dispatcher(res, result.user_res.dataValues, 'error', speeches.ADMIN_EXISTS, 406));
            return res.status(201).send(dispatcher(res, result.profile.dataValues, 'success', speeches.USER_REGISTERED_SUCCESSFULLY, 201));
        }
        return res.status(406).send(dispatcher(res, null, 'error', speeches.USER_ROLE_REQUIRED, 406));
    }
    //fetching details of Admin and Eadmin users
    protected async getData(req: Request, res: Response, next: NextFunction) {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EADMIN') {
            throw unauthorized(speeches.ROLE_ACCES_DECLINE)
        }
        try {
            const result = await this.crudService.findAll(admin, {
                attributes: [
                    "admin_id",
                    "status",
                    "permission"
                ],
                include: {
                    model: user,
                    attributes: [
                        "user_id",
                        "username",
                        "full_name",
                        "role"
                    ]
                }
            })
            return res.status(200).send(dispatcher(res, result, 'success'));
        } catch (error) {
            next(error);
        }

    }
    //updating details of admin and Eadmin users with the admin id
    protected async updateData(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { model } = req.params;
            if (model) {
                this.model = model;
            };
            const where: any = {};
            const newParamId = await this.authService.decryptGlobal(req.params.id);
            where[`${this.model}_id`] = newParamId;
            const modelLoaded = await this.loadModel(model);
            const payload = this.autoFillTrackingColumns(req, res, modelLoaded)
            const findAdminDetail = await this.crudService.findOne(modelLoaded, { where: where });
            if (!findAdminDetail || findAdminDetail instanceof Error) {
                throw notFound();
            } else {
                const adminData = await this.crudService.update(modelLoaded, payload, { where: where });
                const userData = await this.crudService.update(user, payload, { where: { user_id: findAdminDetail.dataValues.user_id } });
                if (!adminData || !userData) {
                    throw badRequest()
                }
                if (adminData instanceof Error) {
                    throw adminData;
                }
                if (userData instanceof Error) {
                    throw userData;
                }
                const data = { userData, admin };
                return res.status(200).send(dispatcher(res, data, 'updated'));
            }
        } catch (error) {
            next(error);
        }
    }
    //login api for the admin & eadmin users 
    //Input username and password
    private async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        let adminDetails: any;
        let newREQQuery: any = {}
        if (req.query.Data) {
            let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
            newREQQuery = JSON.parse(newQuery);
        } else if (Object.keys(req.query).length !== 0) {
            return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
        }
        if (newREQQuery.eAdmin && newREQQuery.eAdmin == 'true') { req.body['role'] = 'EADMIN' } else if (newREQQuery.report && newREQQuery.report == 'true') { req.body['role'] = 'REPORT' } else { req.body['role'] = 'ADMIN' }
        const result = await this.authService.login(req.body);
        if (!result) {
            return res.status(404).send(dispatcher(res, result, 'error', speeches.USER_NOT_FOUND));
        } else if (result.error) {
            return res.status(401).send(dispatcher(res, result.error, 'error', speeches.USER_RISTRICTED, 401));
        } else {
            adminDetails = await this.authService.getServiceDetails('admin', { user_id: result.data.user_id });
            result.data['permission'] = adminDetails.dataValues.permission;
            if (!adminDetails) {
                result.data['admin_id'] = null;
            } else {
                result.data['admin_id'] = adminDetails.dataValues.admin_id;
            }
            return res.status(200).send(dispatcher(res, result.data, 'success', speeches.USER_LOGIN_SUCCESS));
        }
    }
    //logout api for the admin & eadmin users 
    private async logout(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        const result = await this.authService.logout(req.body, res);
        if (result.error) {
            next(result.error);
        } else {
            return res.status(200).send(dispatcher(res, speeches.LOGOUT_SUCCESS, 'success'));
        }
    }
    //To decrypte the encrypte value
    private async getknowqueryparm(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN') {
            throw unauthorized(speeches.ROLE_ACCES_DECLINE)
        }
        try {
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            return res.status(200).send(dispatcher(res, newREQQuery, 'success'));
        } catch (error) {
            next(error);
        }

    }
    // creating encrypted value
    private async getcreatequeryparm(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN') {
            throw unauthorized(speeches.ROLE_ACCES_DECLINE)
        }
        try {
            let newREQQuery: any = {}
            if (req.query.value) {
                newREQQuery['value'] = await this.authService.encryptGlobal(req.query.value);
            }
            if (req.body) {
                newREQQuery['body'] = await this.authService.encryptGlobal(JSON.stringify(req.body));
            }
            return res.status(200).send(dispatcher(res, newREQQuery, 'success'));
        } catch (error) {
            next(error);
        }

    }
    //change password for admin and eadmin
    private async changePassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN' && res.locals.role !== 'EADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        const result = await this.authService.changePassword(req.body, res);
        if (!result) {
            return res.status(404).send(dispatcher(res, null, 'error', speeches.USER_NOT_FOUND));
        } else if (result.error) {
            return res.status(404).send(dispatcher(res, result.error, 'error', result.error));
        }
        else if (result.match) {
            return res.status(404).send(dispatcher(res, null, 'error', speeches.USER_PASSWORD));
        } else {
            return res.status(202).send(dispatcher(res, result.data, 'accepted', speeches.USER_PASSWORD_CHANGE, 202));
        }
    }
    //sending email in bulk for select users
    //Input list of emails and msg
    private async bulkEmail(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN') {
            return res.status(401).send(dispatcher(res, '', 'error', speeches.ROLE_ACCES_DECLINE, 401));
        }
        try {
            const { msg, subject, emails } = req.body;
            const payload = this.autoFillTrackingColumns(req, res, email);
            await this.crudService.create(email, payload);
            let resultdata: any = [];
            const arrayOfUsernames = await this.authService.ConverListemail(emails);

            if (arrayOfUsernames.length > 49) {
                function splitArray(arr: any, chunkSize: any) {
                    let result = [];
                    for (let i = 0; i < arr.length; i += chunkSize) {
                        result.push(arr.slice(i, i + chunkSize));
                    }
                    return result;
                }
                let splitArrays = splitArray(arrayOfUsernames, 49);
                splitArrays.map(async (smallarrayofusername, i) => {
                    resultdata = await this.authService.triggerBulkEmail(smallarrayofusername, msg, subject);
                })
            } else {
                resultdata.push(await this.authService.triggerBulkEmail(arrayOfUsernames, msg, subject));
            }

            return res.status(200).send(dispatcher(res, resultdata, 'Email sent'));
        } catch (error) {
            next(error);
        }
    }
    //Encrypting normal password 
    private async encryptedPassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        if (res.locals.role !== 'ADMIN') {
            throw unauthorized(speeches.ROLE_ACCES_DECLINE)
        }
        try {
            let result = {}
            if (req.body.convertCount === 'single') {
                result = await bcrypt.hashSync(await this.authService.generateCryptEncryption(req.body.value), '$2a$10$iXP5unZT6syNFAlPYvzoPu')
            } else if (req.body.convertCount === 'multi') {
                result = await Promise.all(
                    req.body.value.map(async (i: any) => {
                        const encryptedValue = await this.authService.generateCryptEncryption(i);
                        const hashedValue = await bcrypt.hash(encryptedValue, '$2a$10$iXP5unZT6syNFAlPYvzoPu');
                        return `${i},${hashedValue}`;
                    })
                );
            }
            return res.status(200).send(dispatcher(res, result, 'success'));
        } catch (error) {
            next(error);
        }

    }
    private async gets3fileaccess(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            if (res.locals.role !== 'ADMIN' && res.locals.role !== 'STUDENT' && res.locals.role !== 'TEAM' && res.locals.role !== 'MENTOR' && res.locals.role !== 'STATE' && res.locals.role !== 'EADMIN' && res.locals.role !== 'EVALUATOR') {
                throw unauthorized(speeches.ROLE_ACCES_DECLINE)
            }
            let newREQQuery: any = {}
            if (req.query.Data) {
                let newQuery: any = await this.authService.decryptGlobal(req.query.Data);
                newREQQuery = JSON.parse(newQuery);
            } else if (Object.keys(req.query).length !== 0) {
                return res.status(400).send(dispatcher(res, '', 'error', 'Bad Request', 400));
            }
            function getContentType(filePath: any) {
                const mimeTypes: any = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.pdf': 'application/pdf',
                    '.doc': 'application/msword',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.xls': 'application/vnd.ms-excel',
                    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    '.ppt': 'application/vnd.ms-powerpoint',
                    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    '.txt': 'text/plain',
                    '.html': 'text/html',
                    '.json': 'application/json',
                    '.zip': 'application/zip',
                    '.csv': 'text/csv',
                    '.mp4': 'video/mp4',
                    '.mp3': 'audio/mpeg'
                };

                // Extract the extension
                const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
                return mimeTypes[ext] || 'application/octet-stream'; // default fallback
            }
            const generateSignedUrl = (filePath: any) => {

                const disposition = 'inline';
                const contentType = getContentType(filePath);
                const queryParams = `response-content-disposition=${encodeURIComponent(disposition)}&response-content-type=${encodeURIComponent(contentType)}`;

                const policy = JSON.stringify({
                    Statement: [
                        {
                            Resource: `${process.env.CLOUDFRONT_BASE}${filePath}?${queryParams}`,
                            Condition: {
                                DateLessThan: {
                                    "AWS:EpochTime": Math.floor(Date.now() / 1000) + 60 * 10,
                                },
                            },
                        },
                    ],
                });
                return getSignedUrl({
                    url: `${process.env.CLOUDFRONT_BASE}${filePath}?${queryParams}`,
                    keyPairId: `${process.env.KEY_PAIR_ID}`,
                    privateKey: `${process.env.CLOUDFRONT_PRIVATE_KEY}`,
                    policy
                });
            };
            const signedUrl = generateSignedUrl(newREQQuery.filePath);
            return res.status(200).send(dispatcher(res, signedUrl, 'success'));
        } catch (error) {
            next(error);
        }

    }

    private async newfileuplad(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            const rawfiles: any = req.files;
            const files: any = Object.values(rawfiles);
            const result: any = {}
            // // Replace these with your actual values
            // const AZURE_STORAGE_CONNECTION_STRING = "<your_connection_string>";
            // const containerName = "<your_container_name>";
            // const localFilePath = files[0].path; // Local file to upload

            // try {
            //     // Create the BlobServiceClient object
            //     const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

            //     // Get a container client
            //     const containerClient = blobServiceClient.getContainerClient(containerName);

            //     // Create container if it doesn't exist
            //     await containerClient.createIfNotExists();

            //     const blobName = files[0].originalFilename;
            //     const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            //     console.log(`Uploading to Azure storage as blob:\n\t${blobName}`);

            //     const uploadBlobResponse = await blockBlobClient.uploadFile(localFilePath);
            //     console.log("Upload complete. Request ID:", uploadBlobResponse.requestId);
            // } catch (err: any) {
            //     console.error("Error uploading file to Azure:", err.message);
            // }
            let newDate = new Date();
            let newFormat = (newDate.getFullYear()) + "-" + (1 + newDate.getMonth()) + "-" + newDate.getUTCDate() + '_' + newDate.getHours() + '-' + newDate.getMinutes() + '-' + newDate.getSeconds();
            const accountName = "aictemicsim";
            const containerName = "datamicsim";
            const sasToken = "?sv=2024-11-04&ss=b&srt=sco&sp=rwdlaciytfx&se=2026-07-30T20:34:32Z&st=2025-07-09T12:34:32Z&spr=https&sig=kCvU3WLqnU6AsghfSCcq1NOJrL0VGL4i1ioHDqZx%2B2s%3D";
            const localFilePath = files[0].path;
            const blobName = `new/test/T${newFormat}`;
            try {
                const blobServiceClient = new BlobServiceClient(
                    `https://${accountName}.blob.core.windows.net${sasToken}`
                );

                const containerClient = blobServiceClient.getContainerClient(containerName);
                const blockBlobClient = containerClient.getBlockBlobClient(blobName);

                console.log(`Uploading file "${blobName}" to Azure using SAS token...`);

                const uploadBlobResponse = await blockBlobClient.uploadFile(localFilePath, {
                    blobHTTPHeaders: {
                        blobContentDisposition: 'inline',
                        blobContentType: 'image/png'
                    }
                });
                console.log("Upload successful. Request ID:", uploadBlobResponse.requestId);
                console.log("Blob URL:", blockBlobClient.url); // This is the public or private URL
                result['data'] = {
                    "Request ID": uploadBlobResponse.requestId,
                    "Blob URL:": blockBlobClient.url
                }
            } catch (err: any) {
                console.error("Azure upload error:", err.message || err);
            }

            return res.status(200).send(dispatcher(res, result, 'success'));
        }
        catch (error) {
            console.log(error)
        }
    }

    private async newEmailservice(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
        try {
            let transporter = nodemailer.createTransport({
                host: "192.168.1.75",
                port: 25,
                secure: false,
                auth: {
                    user: "",
                    pass: ""
                },
                tls: {
                    rejectUnauthorized: false, // Set to true in production
                },
            });

            const info = await transporter.sendMail({
                from: "aicte.admin@aicte-india.org",
                to: "ramant@medhatech.in",
                subject: "Test email old",
                text: "Hello from AWS SES via SMTP!old values"
            });
            console.log("Message sent:", info.messageId);
            return res.status(200).send(dispatcher(res, info.messageId, 'success'));
        }
        catch (err) {
            console.log(err)
        }
    }
};