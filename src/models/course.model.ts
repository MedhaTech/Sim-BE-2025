import { Association, CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { constents } from '../configs/constents.config';
import db from '../utils/dbconnection.util';
import { course_module } from './course_module.model';

export class course extends Model<InferAttributes<course>, InferCreationAttributes<course>> {
    declare course_id: CreationOptional<number>;
    declare title: string;
    declare description: string;
    declare status: Enumerator;
    declare thumbnail: string;
    declare created_by: number;
    declare created_at: Date;
    declare updated_by: number;
    declare updated_at: Date;

    static associate(models: any) {
        // define association here
        course.hasMany(models, { foreignKey: 'course_id', as: 'courseModules' });
    }


}


course.init(
    {
        course_id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },
        thumbnail: {
            type: DataTypes.STRING,
            defaultValue: constents.default_image_path
        },
        status: {
            type: DataTypes.ENUM(...Object.values(constents.common_status_flags.list)),
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
        tableName: 'courses',
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: 'created_at',
    }
);