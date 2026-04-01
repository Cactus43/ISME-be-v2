import { Options } from 'sequelize';
import { Config } from './Index';
import { Logger } from '../Utils/Logger';

const _sqlLogger = Logger.child({ module: 'sequelize' });


// ─── Sequelize Options ─────────────────────────────────────────────────────

export const DATABASE_CONFIG: Options = {
  dialect: 'mysql',
  host: Config.Db.Host,
  port: Config.Db.Port,
  database: Config.Db.Name,
  username: Config.Db.User,
  password: Config.Db.Password,
  logging: Config.Env === 'development'
    ? (sql: string) => _sqlLogger.debug(sql)
    : false,
  pool: {
    max: Config.Db.Pool.Max,
    min: Config.Db.Pool.Min,
    acquire: Config.Db.Pool.Acquire,
    idle: Config.Db.Pool.Idle,
  },
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
  },
};
