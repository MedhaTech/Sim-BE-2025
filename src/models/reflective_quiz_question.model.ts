import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { constents } from '../configs/constents.config';
import db from '../utils/dbconnection.util';
import { video } from './video.model';

export class reflective_quiz_question extends Model<InferAttributes<reflective_quiz_question>, InferCreationAttributes<reflective_quiz_question>> {
    declare reflective_quiz_question_id: CreationOptional<number>;
    declare video_id: ForeignKey<number>;
    declare question_no: number;
    declare question: string;
    declare option_a: string;
    declare option_b: string;
    declare option_c: string;
    declare option_d: string;
    declare correct_ans: string;
    declare level: Enumerator;
    declare type: Enumerator;
    declare msg_ans_correct: string;
    declare msg_ans_wrong: string;
    declare question_image: string;
    declare redirect_to: ForeignKey<number>;
    declare status: Enumerator;
    declare created_by: number;
    declare created_at: Date;
    declare updated_by: number;
    declare updated_at: Date;
}

reflective_quiz_question.init(
    {
        reflective_quiz_question_id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        video_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        question_no: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        question: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        option_a: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        option_b: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        option_c: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        option_d: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        correct_ans: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        level: {
            type: DataTypes.ENUM(...Object.values(constents.quiz_question_level_flags.list)),
            allowNull: false,
            defaultValue: constents.quiz_question_level_flags.default
        },
        type: {
            type: DataTypes.ENUM(...Object.values(constents.quiz_question_type_flags.list)),
            allowNull: false,
            defaultValue: constents.quiz_question_type_flags.default
        },
        redirect_to: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        question_image: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

        msg_ans_correct: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: "",
        },
        msg_ans_wrong: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: "",
        },
        status: {
            type: DataTypes.ENUM(...Object.values(constents.common_status_flags.list)),
            allowNull: false,
            defaultValue: constents.common_status_flags.default
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
        },
        updated_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
            onUpdate: new Date().toLocaleString()
        }
    },
    {
        sequelize: db,
        tableName: 'reflective_quiz_questions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
);

reflective_quiz_question.belongsTo(video, { foreignKey: 'video_id' })
video.hasMany(reflective_quiz_question, { foreignKey: 'video_id' })
