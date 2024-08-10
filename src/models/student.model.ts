import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import bcrypt from 'bcrypt';
import { constents } from '../configs/constents.config';
import db from '../utils/dbconnection.util';
import { baseConfig } from '../configs/base.config';
import { user } from './user.model';

export class student extends Model<InferAttributes<student>, InferCreationAttributes<student>> {
    declare student_id: CreationOptional<number>;
    declare user_id: number;
    declare team_id: string;
    declare full_name: string;
    declare Age: number;
    declare Grade: string;
    declare Gender: string;
    declare badges: string;
    declare disability: string;
    declare certificate: number;
    declare status: Enumerator;
    declare created_by: number;
    declare created_at: Date;
    declare updated_by: number;
    declare updated_at: Date;
}

student.init(
    {
        student_id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        team_id: {
            type: DataTypes.STRING,
        },
        full_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        Age: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        Grade: {
            type: DataTypes.STRING,
            allowNull: true
        },
        Gender: {
            type: DataTypes.STRING,
            allowNull: true
        },
        disability: {
            type: DataTypes.STRING
        },
        badges: {
            type: DataTypes.TEXT('long')
        },
        status: {
            type: DataTypes.ENUM(...Object.values(constents.common_status_flags.list)),
            defaultValue: constents.common_status_flags.default
        },
        certificate: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null
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
        tableName: 'students',
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: 'created_at',
        hooks: {
            beforeCreate: async (user: any) => {
                if (user.password) {
                    user.password = await bcrypt.hashSync(user.password, process.env.SALT || baseConfig.SALT);
                }
            },
            beforeUpdate: async (user) => {
                if (user.password) {
                    user.password = await bcrypt.hashSync(user.password, process.env.SALT || baseConfig.SALT);
                }
            }
        }
    }
);

student.belongsTo(user, { foreignKey: 'user_id' });
user.hasMany(student, { foreignKey: 'user_id' });
student.belongsTo(user, { foreignKey: 'user_id' });
user.hasMany(student, { foreignKey: 'user_id' });