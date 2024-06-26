import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import db from '../utils/dbconnection.util';
import { constents } from '../configs/constents.config';
import { mentor } from './mentor.model';
import { student } from './student.model';
import { challenge_response } from './challenge_response.model';
import { user } from './user.model';

export class team extends Model<InferAttributes<team>, InferCreationAttributes<team>> {
    declare team_id: CreationOptional<number>;
    declare team_name: string;
    declare mentor_id: string;
    declare status: Enumerator;
    declare created_by: number;
    declare created_at: Date;
    declare updated_by: number;
    declare updated_at: Date;
}

team.init(
    {
        team_id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        team_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        mentor_id: {
            type: DataTypes.INTEGER,
            allowNull: true
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
        tableName: 'teams',
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: 'created_at',
    }
);
team.belongsTo(user, { foreignKey: 'user_id', constraints: false, scope: { role: 'TEAM' } });
user.hasOne(team, { foreignKey: 'user_id', constraints: false });
student.belongsTo(team, { foreignKey: 'team_id', constraints: false });
team.hasMany(student, { foreignKey: 'team_id', constraints: false });
team.belongsTo(mentor, { foreignKey: 'mentor_id', constraints: false });
mentor.hasOne(team, { foreignKey: 'mentor_id', constraints: false });
challenge_response.belongsTo(team, { foreignKey: 'team_id', constraints: false });
team.hasMany(challenge_response, { foreignKey: 'team_id', constraints: false });