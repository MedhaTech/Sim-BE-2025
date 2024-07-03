import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { constents } from '../configs/constents.config';
import db from '../utils/dbconnection.util';
import { course_module } from './course_module.model';
import { video } from './video.model';

export class course_topic extends Model<InferAttributes<course_topic>, InferCreationAttributes<course_topic>> {
    declare course_topic_id: CreationOptional<number>;
    declare course_module_id: number;
    declare topic_type_id: number;
    declare topic_type: Enumerator;
    declare title: string;
    declare status: Enumerator;
    declare created_by: number;
    declare created_at: Date;
    declare updated_by: number;
    declare updated_at: Date;

    static associate(models: any) {
        // define association here
        course_topic.belongsTo(course_module, { foreignKey: 'course_module_id', as: 'course_topics' });
    }
}


course_topic.init(
    {
        course_topic_id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        course_module_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        topic_type_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null
        },
        topic_type: {
            type: DataTypes.ENUM(...Object.values(constents.topic_type_flags.list)),
            allowNull: false,
            defaultValue: constents.topic_type_flags.default
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
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
        tableName: 'course_topics',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
);

course_topic.belongsTo(course_module, { foreignKey: 'course_module_id', as: 'course_topics' });
course_module.hasMany(course_topic, { foreignKey: 'course_module_id' });

course_topic.belongsTo(video, {
    foreignKey: 'topic_type_id',
    constraints: false
})
video.hasMany(course_topic, {
    foreignKey: 'topic_type_id',
    constraints: false,
    scope: {
        topic_type: "VIDEO"
    }
})