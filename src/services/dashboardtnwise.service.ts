import { challenge_response } from "../models/challenge_response.model";
import { dashboard_tn_stat } from "../models/dashboard_tn_stat.model";
import { mentor } from "../models/mentor.model";
import { organization } from "../models/organization.model";
import { student } from "../models/student.model";
import { team } from "../models/team.model";
import BaseService from "./base.service";
import { Op } from "sequelize";

export default class DashboardTNService extends BaseService {
    /**
     * truncates the data in dashboard TN map stats tables and re entries
     * @returns Object 
     */
    async resetTNMapStats() {
        try {
            let uniqueDistricts: any;
            let bulkCreateArray: any = [];
            uniqueDistricts = await this.crudService.findAll(organization, {
                where: {
                    state: "Tamil Nadu",
                    category: { [Op.not]: 'Non ATL' }
                },
                group: ["district"]
            });
            if (!uniqueDistricts || uniqueDistricts.length <= 0) {
                console.log("uniqueDistricts", uniqueDistricts)
                return
            }
            if (uniqueDistricts instanceof Error) {
                console.log("uniqueDistricts", uniqueDistricts)
                return
            }
            for (const district of uniqueDistricts) {
                try {
                    if (district.district === null) {
                        continue
                    }
                    const stats: any = await this.getMapStatsForDistrict(district.dataValues.district)
                    bulkCreateArray.push({
                        overall_schools: stats.schoolIdsInDistrict.length,
                        reg_schools: stats.registeredSchoolIdsInDistrict.length,
                        teams: stats.teamIdInDistrict.length,
                        ideas: stats.challengeInDistrict.length,
                        district_name: district.district,
                        state: district.dataValues.state,
                        students: stats.studentsInDistric.length,
                        schools_with_teams: stats.schoolIdsInDistrictWithTeams.length,
                        reg_mentors: stats.registerMentor.length
                    })
                } catch (err) {
                    console.log(err)
                }
            }
            
            await this.crudService.delete(dashboard_tn_stat, { where: {}, truncate: true });
            const result = await this.crudService.bulkCreate(dashboard_tn_stat, bulkCreateArray);
            return result;
        } catch (err) {
            return err
        }
    }

    /**
     * Get map stats data with based on district
     * @param argdistric String default set to null
     * @returns object
     */
    async getMapStatsForDistrict(argdistric: any = null) {
        try {
            let whereClause = {}
            let schoolIdsInDistrict: any = [];
            let mentorIdInDistrict: any = [];
            let registeredSchoolIdsInDistrict: any = [];
            let schoolIdsInDistrictWithTeams: any = [];
            let teamIdInDistrict: any = [];
            let challengeInDistrict: any = [];
            let studentsInDistric: any = [];
            let registerMentor: any = [];

            if (argdistric) {
                whereClause = {
                    district: argdistric,
                }
            }

            whereClause = {
                ...whereClause,
                status: "ACTIVE"
            }

            const overAllSchool = await this.crudService.findAll(organization, {
                where: whereClause
            });
            if (!overAllSchool || (!overAllSchool.length) || overAllSchool.length == 0) {
                return {
                    schoolIdsInDistrict: schoolIdsInDistrict,
                    registeredSchoolIdsInDistrict: registeredSchoolIdsInDistrict,
                    teamIdInDistrict: teamIdInDistrict,
                    challengeInDistrict: challengeInDistrict,
                    studentsInDistric: studentsInDistric,
                    schoolIdsInDistrictWithTeams: schoolIdsInDistrictWithTeams,
                    registerMentor: registerMentor
                }
            }
            schoolIdsInDistrict = overAllSchool.map((Element: any) => Element.dataValues.organization_code);
            const mentorReg = await this.crudService.findAll(mentor, {
                where: {
                    organization_code: schoolIdsInDistrict,
                    status: 'ACTIVE'
                }
            });
            if (!mentorReg || (!mentorReg.length) || mentorReg.length == 0) {
                return {
                    schoolIdsInDistrict: schoolIdsInDistrict,
                    registeredSchoolIdsInDistrict: registeredSchoolIdsInDistrict,
                    teamIdInDistrict: teamIdInDistrict,
                    challengeInDistrict: challengeInDistrict,
                    studentsInDistric: studentsInDistric,
                    schoolIdsInDistrictWithTeams: schoolIdsInDistrictWithTeams,
                    registerMentor: registerMentor
                }
            }
            mentorIdInDistrict = mentorReg.map((Element: any) => Element.dataValues.mentor_id);//changed this to  user_id from mentor_id, because teams has mentor linked with team via user_id as value in the mentor_id collumn of the teams table

            const schoolRegistered = await this.crudService.findAll(mentor, {
                where: {
                    mentor_id: mentorIdInDistrict,
                    status: 'ACTIVE'
                },
                group: ['organization_code']
            });
            if (!schoolRegistered || (!schoolRegistered.length) || schoolRegistered.length == 0) {
                registeredSchoolIdsInDistrict = []
            } else {
                registeredSchoolIdsInDistrict = schoolRegistered.map((Element: any) => Element.dataValues.organization_code);
            }

            const RegisteredMentor = await this.crudService.findAll(mentor, {
                where: {
                    mentor_id: mentorIdInDistrict,
                    status: 'ACTIVE'
                },
            });
            if (!RegisteredMentor || (!RegisteredMentor.length) || RegisteredMentor.length == 0) {
                registerMentor = []
            } else {
                registerMentor = RegisteredMentor.map((Element: any) => Element.dataValues.organization_code);
            }


            const teamReg = await this.crudService.findAll(team, {
                where: {
                    mentor_id: mentorIdInDistrict,
                    status: 'ACTIVE'
                }
            });
            if (!teamReg || (!teamReg.length) || teamReg.length == 0) {
                return {
                    schoolIdsInDistrict: schoolIdsInDistrict,
                    registeredSchoolIdsInDistrict: registeredSchoolIdsInDistrict,
                    teamIdInDistrict: teamIdInDistrict,
                    challengeInDistrict: challengeInDistrict,
                    studentsInDistric: studentsInDistric,
                    schoolIdsInDistrictWithTeams: schoolIdsInDistrictWithTeams,
                    registerMentor: registerMentor
                }
            }
            teamIdInDistrict = teamReg.map((Element: any) => Element.dataValues.team_id);

            //u could call below as schools with teams since one school can have only one mentor 
            const distinctMentorsWithTeams = await team.findAll({
                attributes: [
                    "mentor_id",
                ],
                where: {
                    mentor_id: mentorIdInDistrict,
                    status: 'ACTIVE'
                },
                group: ['mentor_id'],
            })
            if (!distinctMentorsWithTeams || (!distinctMentorsWithTeams.length) || distinctMentorsWithTeams.length == 0) {
                schoolIdsInDistrictWithTeams = []
            } else {
                schoolIdsInDistrictWithTeams = distinctMentorsWithTeams.map((Element: any) => Element.dataValues.mentor_id);
            }


            const challengeReg = await this.crudService.findAll(challenge_response, {
                where: {
                    team_id: teamIdInDistrict,
                    status: 'SUBMITTED'
                }
            });

            if (!challengeReg || (!challengeReg.length) || challengeReg.length == 0) {
                challengeInDistrict = []
            } else {
                challengeInDistrict = challengeReg.map((Element: any) => Element.dataValues.challenge_response_id);
            }


            const studentsResult = await student.findAll({
                attributes: [
                    "user_id",
                    "student_id"
                ],
                where: {
                    team_id: teamIdInDistrict,
                    status: 'ACTIVE'
                }
            })
            if (!studentsResult || (!studentsResult.length) || studentsResult.length == 0) {
                studentsInDistric = []
            } else {
                studentsInDistric = studentsResult.map((Element: any) => Element.dataValues.student_id);
            }
            studentsInDistric = studentsResult.map((Element: any) => Element.dataValues.student_id);

            return {
                schoolIdsInDistrict: schoolIdsInDistrict,
                registeredSchoolIdsInDistrict: registeredSchoolIdsInDistrict,
                teamIdInDistrict: teamIdInDistrict,
                challengeInDistrict: challengeInDistrict,
                studentsInDistric: studentsInDistric,
                schoolIdsInDistrictWithTeams: schoolIdsInDistrictWithTeams,
                registerMentor: registerMentor
            }
        } catch (err) {
            return err
        }
    }
}