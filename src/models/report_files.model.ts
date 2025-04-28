import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import db from '../utils/dbconnection.util';
import { constents } from '../configs/constents.config';


export class report_file extends Model<InferAttributes<report_file>, InferCreationAttributes<report_file>> {

    declare report_file_id: CreationOptional<number>;
    declare report_name: string;
    declare filters: string;
    declare columns: string;
    declare status: Enumerator;
    declare created_by: number;
    declare created_at: Date;
    declare updated_by: number;
    declare updated_at: Date;

}

report_file.init(
    {
        report_file_id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        report_name: {
            type: DataTypes.STRING
        },
        filters: {
            type: DataTypes.STRING
        },
        columns: {
            type: DataTypes.STRING
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
        tableName: 'report_files',
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: 'created_at',
    }
);