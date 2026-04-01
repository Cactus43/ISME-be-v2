import { Op } from 'sequelize';
import { AccessToken } from '../Data/Models/AccessToken';
import type { AccessTokenAttributes } from '../Data/Models/AccessToken';
import type { ITokenAdapter } from '../Data/Interfaces/IAdapter';


// ─── TokenAdapter ──────────────────────────────────────────────────────────
// Unified: single access_tokens table with source discriminator.

export class TokenAdapter implements ITokenAdapter {

  /** Persist a new token (backoffice or mobile) */
  async CreateToken(data: Partial<AccessTokenAttributes>): Promise<void> {
    await AccessToken.create(data as AccessTokenAttributes);
  }

  /** Find active (non-revoked, non-expired) token by signature+source */
  async FindActiveToken(signature: string, source: 'backoffice' | 'mobile'): Promise<AccessTokenAttributes | null> {
    const record = await AccessToken.findOne({
      where: {
        signature,
        source,
        revoked_at: { [Op.eq]: null },
        expires_at: { [Op.gt]: new Date() },
      },
    });
    return record?.get({ plain: true }) ?? null;
  }

  /** Revoke a token by signature+source */
  async RevokeToken(signature: string, source: 'backoffice' | 'mobile'): Promise<number> {
    const [affected] = await AccessToken.update(
      { revoked_at: new Date() },
      { where: { signature, source, revoked_at: null } },
    );
    return affected;
  }
}
