import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import db from '../utils/dbconnection.util';
import { course } from './course.model';
import { constents } from '../configs/constents.config';



export class course_module extends Model<InferAttributes<course_module>, InferCreationAttributes<course_module>> {
    declare course_module_id: CreationOptional<number>;
    declare course_id: string;
    declare title: string;
    declare description: string;
    declare status: Enumerator;
    declare created_by: number;
    declare created_at: Date;
    declare updated_by: number;
    declare updated_at: Date;
}

course_module.init(
    {
        course_module_id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        course_id: {
            type: DataTypes.INTEGER,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type:  DataTypes.TEXT('long'),
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM(...Object.values(constents.common_status_flags.list)),
            defaultValue: constents.common_status_flags.default
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue:null
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
        tableName: 'course_modules',
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: 'created_at',
    }
);

course_module.belongsTo(course, { foreignKey: 'course_id'});
course.hasMany(course_module, { foreignKey: 'course_id'});
