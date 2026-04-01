import { User } from '../Data/Models/User';
import type { UserAttributes } from '../Data/Models/User';
import type { IUserAdapter } from '../Data/Interfaces/IAdapter';


// ─── UserAdapter ───────────────────────────────────────────────────────────
// Unified: covers admins, viewers, and operators (role-discriminated).

export class UserAdapter implements IUserAdapter {

  /** Look up by email — backoffice login path */
  async FindByEmail(email: string): Promise<UserAttributes | null> {
    const row = await User.findOne({
      where: { email, is_active: 1, deleted_at: null },
    });
    return row?.get({ plain: true }) ?? null;
  }

  /** Look up by username — mobile login path */
  async FindByUsername(username: string): Promise<UserAttributes | null> {
    const row = await User.findOne({
      where: { username, is_active: 1, deleted_at: null },
    });
    return row?.get({ plain: true }) ?? null;
  }

  /** Find by primary key with optional password exclusion */
  async FindById(id: number, opts?: { excludePassword?: boolean; includeInactive?: boolean }): Promise<UserAttributes | null> {
    const exclude = opts?.excludePassword ? ['password'] : [];
    const where: Record<string, unknown> = { id, deleted_at: null };
    if (!opts?.includeInactive) where.is_active = 1;
    const row = await User.findOne({
      where,
      attributes: { exclude },
    });
    return row?.get({ plain: true }) ?? null;
  }

  /** All active users of a given role (e.g. 'operator') */
  async FindAllByRole(role: string, opts?: { excludePassword?: boolean; includeInactive?: boolean }): Promise<UserAttributes[]> {
    const exclude = opts?.excludePassword ? ['password'] : [];
    const where: Record<string, unknown> = { role, deleted_at: null };
    if (!opts?.includeInactive) where.is_active = 1;
    const rows = await User.findAll({
      where,
      attributes: { exclude },
      order: [['lastname', 'ASC'], ['firstname', 'ASC']],
    });
    return rows.map(r => r.get({ plain: true }));
  }

  /** Create a new user (any role) */
  async Create(data: Partial<UserAttributes>): Promise<UserAttributes> {
    const row = await User.create(data as UserAttributes);
    return row.get({ plain: true });
  }

  /** Patch fields on an existing user */
  async Update(id: number, data: Partial<UserAttributes>): Promise<UserAttributes | null> {
    const row = await User.findByPk(id);
    if (!row || row.deleted_at) return null;
    await row.update(data);
    return row.get({ plain: true });
  }

  /** Soft-delete: set deleted_at + deleted_by + is_active=false */
  async SoftDelete(id: number, deletedBy?: number | null): Promise<void> {
    const row = await User.findByPk(id);
    if (!row || row.deleted_at) return;
    await row.update({ deleted_at: new Date(), deleted_by: deletedBy ?? null, is_active: false });
  }
}
