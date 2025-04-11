import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, or } from 'sequelize';
import db from '../utils/dbconnection.util';
import { constents } from '../configs/constents.config';


export class state_specific extends Model<InferAttributes<state_specific>, InferCreationAttributes<state_specific>> {
    declare state_specific_id: CreationOptional<number>;
    declare state_name: string;
    declare status: Enumerator;
    declare created_by: number;
    declare created_at: Date;
    declare updated_by: number;
    declare updated_at: Date;
    declare role: string;
    declare whatapp_link: string;
    declare ideaSubmission: number;
    declare certificate: number;
    declare mentor_note: string;
    declare student_note: string;
}

state_specific.init({
    state_specific_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    state_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING
    },
    whatapp_link: {
        type: DataTypes.STRING
    },
    ideaSubmission: {
        type: DataTypes.INTEGER
    },
    certificate: {
        type: DataTypes.INTEGER
    },
    mentor_note: {
        type: DataTypes.STRING
    },
    student_note: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.ENUM(...Object.values(constents.organization_status_flags.list)),
        defaultValue: constents.organization_status_flags.default
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
        tableName: 'state_specific',
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: 'created_at',
    }
);