import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, or } from 'sequelize';
import db from '../utils/dbconnection.util';
import { constents } from '../configs/constents.config';


export class state_coordinators extends Model<InferAttributes<state_coordinators>, InferCreationAttributes<state_coordinators>> {
    declare state_coordinators_id: CreationOptional<number>;
    declare username: string;
    declare password: string;
    declare state_name: string;
    declare status: Enumerator;
    declare created_by: number;
    declare created_at: Date;
    declare updated_by: number;
    declare updated_at: Date;
    declare is_loggedin: Enumerator;
    declare last_login: Date;
    declare role: string;
    declare whatapp_link: string;
    declare ideaSubmission: number;
}

state_coordinators.init({
    state_coordinators_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
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
    is_loggedin: {
        type: DataTypes.ENUM(...Object.values(constents.common_yes_no_flags.list)),
        defaultValue: constents.common_yes_no_flags.default
    },
    last_login: {
        type: DataTypes.DATE
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
        tableName: 'state_coordinators',
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: 'created_at',
    }
);