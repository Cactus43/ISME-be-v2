import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

/* ─── Column contract ─────────────────────────────────────────── */
export interface InterventionAttributes {
  id: number;

  // Identity
  tag: string;
  business_team: string;
  unit: string | null;

  // Classification
  intervention_type: number;
  priority: number;
  status: number;

  // Location & Equipment
  location: string;
  component_equipment: string;
  size: string | null;

  // Inspection
  operator_id: number | null;
  inspection_date: Date;
  device_id: number | null;

  // Measurements
  pressure: string | null;
  plume_length: string | null;
  plume_spec: string | null;
  steam_flow_kg: number | null;
  steam_flow_tonne: number | null;
  nominal_flow: string | null;
  pipe_temperature: string | null;

  // Steam Trap
  malfunctioning_type: string | null;
  discharger_type: string | null;
  dn_discharger: string | null;
  service: string | null;
  steam_discharge_to_closed_system: number | null;

  // Logistics
  scaffolding: string | null;
  interception_possibility: string | null;
  interception_valve_status: number | null;
  competence: string | null;
  need_for_insulation: number | null;
  insulation_material: string | null;
  metal_sheet: string | null;
  metal_sheet_temperature: string | null;
  trait_length: string | null;
  asbestos: number | null;

  // Notifications
  notification: number | null;
  closure_notification: string | null;

  // Repair
  repair_date: Date | null;
  intervention_description: string | null;
  post_date: string | null;
  reason: string | null;

  // Audit
  created_at: Date;
  created_by: number | null;
  updated_at: Date;
  updated_by: number | null;
  deleted_at: Date | null;
  deleted_by: number | null;
}

type InterventionCreation = Optional<
  InterventionAttributes,
  | 'id' | 'unit' | 'intervention_type' | 'priority' | 'status' | 'size'
  | 'operator_id' | 'device_id'
  | 'pressure' | 'plume_length' | 'plume_spec' | 'steam_flow_kg' | 'steam_flow_tonne'
  | 'nominal_flow' | 'pipe_temperature'
  | 'malfunctioning_type' | 'discharger_type' | 'dn_discharger' | 'service' | 'steam_discharge_to_closed_system'
  | 'scaffolding' | 'interception_possibility' | 'interception_valve_status' | 'competence'
  | 'need_for_insulation' | 'insulation_material' | 'metal_sheet' | 'metal_sheet_temperature'
  | 'trait_length' | 'asbestos'
  | 'notification' | 'closure_notification'
  | 'repair_date' | 'intervention_description' | 'post_date' | 'reason'
  | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'deleted_at' | 'deleted_by'
>;

/* ─── Sequelize model ─────────────────────────────────────────── */
export class Intervention extends Model<InterventionAttributes, InterventionCreation> implements InterventionAttributes {
  declare id: number;
  declare tag: string;
  declare business_team: string;
  declare unit: string | null;
  declare intervention_type: number;
  declare priority: number;
  declare status: number;
  declare location: string;
  declare component_equipment: string;
  declare size: string | null;
  declare operator_id: number | null;
  declare inspection_date: Date;
  declare device_id: number | null;
  declare pressure: string | null;
  declare plume_length: string | null;
  declare plume_spec: string | null;
  declare steam_flow_kg: number | null;
  declare steam_flow_tonne: number | null;
  declare nominal_flow: string | null;
  declare pipe_temperature: string | null;
  declare malfunctioning_type: string | null;
  declare discharger_type: string | null;
  declare dn_discharger: string | null;
  declare service: string | null;
  declare steam_discharge_to_closed_system: number | null;
  declare scaffolding: string | null;
  declare interception_possibility: string | null;
  declare interception_valve_status: number | null;
  declare competence: string | null;
  declare need_for_insulation: number | null;
  declare insulation_material: string | null;
  declare metal_sheet: string | null;
  declare metal_sheet_temperature: string | null;
  declare trait_length: string | null;
  declare asbestos: number | null;
  declare notification: number | null;
  declare closure_notification: string | null;
  declare repair_date: Date | null;
  declare intervention_description: string | null;
  declare post_date: string | null;
  declare reason: string | null;
  declare readonly created_at: Date;
  declare created_by: number | null;
  declare readonly updated_at: Date;
  declare updated_by: number | null;
  declare deleted_at: Date | null;
  declare deleted_by: number | null;

  // Association helpers
  declare Operator?: any;
  declare Device?: any;

  static InitModel(sequelize: Sequelize): void {
    Intervention.init(
      {
        id:                              { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        tag:                             { type: DataTypes.STRING(32), allowNull: false },
        business_team:                   { type: DataTypes.STRING(16), allowNull: false },
        unit:                            { type: DataTypes.STRING(32), allowNull: true },
        intervention_type:               { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
        priority:                        { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
        status:                          { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
        location:                        { type: DataTypes.STRING(1024), allowNull: false },
        component_equipment:             { type: DataTypes.STRING(255), allowNull: false },
        size:                            { type: DataTypes.STRING(64), allowNull: true },
        operator_id:                     { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        inspection_date:                 { type: DataTypes.DATE, allowNull: false },
        device_id:                       { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        pressure:                        { type: DataTypes.STRING(32), allowNull: true },
        plume_length:                    { type: DataTypes.STRING(255), allowNull: true },
        plume_spec:                      { type: DataTypes.STRING(255), allowNull: true },
        steam_flow_kg:                   { type: DataTypes.DOUBLE, allowNull: true, defaultValue: 0 },
        steam_flow_tonne:                { type: DataTypes.DOUBLE, allowNull: true, defaultValue: 0 },
        nominal_flow:                    { type: DataTypes.STRING(255), allowNull: true },
        pipe_temperature:                { type: DataTypes.STRING(255), allowNull: true },
        malfunctioning_type:             { type: DataTypes.STRING(255), allowNull: true },
        discharger_type:                 { type: DataTypes.STRING(255), allowNull: true },
        dn_discharger:                   { type: DataTypes.STRING(255), allowNull: true },
        service:                         { type: DataTypes.STRING(1024), allowNull: true },
        steam_discharge_to_closed_system: { type: DataTypes.TINYINT, allowNull: true },
        scaffolding:                     { type: DataTypes.STRING(128), allowNull: true },
        interception_possibility:        { type: DataTypes.STRING(255), allowNull: true },
        interception_valve_status:       { type: DataTypes.TINYINT, allowNull: true },
        competence:                      { type: DataTypes.STRING(255), allowNull: true },
        need_for_insulation:             { type: DataTypes.TINYINT, allowNull: true },
        insulation_material:             { type: DataTypes.STRING(255), allowNull: true },
        metal_sheet:                     { type: DataTypes.STRING(255), allowNull: true },
        metal_sheet_temperature:         { type: DataTypes.STRING(255), allowNull: true },
        trait_length:                    { type: DataTypes.STRING(255), allowNull: true },
        asbestos:                        { type: DataTypes.TINYINT, allowNull: true },
        notification:                    { type: DataTypes.INTEGER, allowNull: true },
        closure_notification:            { type: DataTypes.STRING(1024), allowNull: true },
        repair_date:                     { type: DataTypes.DATE, allowNull: true },
        intervention_description:        { type: DataTypes.STRING(2048), allowNull: true },
        post_date:                       { type: DataTypes.STRING(2048), allowNull: true },
        reason:                          { type: DataTypes.STRING(255), allowNull: true },
        created_at:                      { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_by:                      { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        updated_at:                      { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_by:                      { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        deleted_at:                      { type: DataTypes.DATE, allowNull: true, defaultValue: null },
        deleted_by:                      { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      },
      {
        sequelize,
        tableName: 'interventions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    );
  }
}
