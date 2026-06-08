const authService = require('../../lib/services/auth.service');
const RefreshToken = require('../../lib/models/RefreshToken');
const { ensureDb, makeUser } = require('../helpers');

beforeAll(ensureDb);

describe('auth.service', () => {
  describe('register', () => {
    it('creates an active user, a free Subscription, and a token pair', async () => {
      const result = await authService.register({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'Passw0rd!',
      });

      expect(result.user.email).toBe('ada@example.com');
      expect(result.user.role).toBe('user');
      expect(result.user.plan).toBe('free');
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));

      const stored = await RefreshToken.findOne({ user: result.user.id });
      expect(stored).toBeTruthy();
      expect(stored.tokenHash).not.toBe(result.refreshToken); // hashed at rest
    });

    it('rejects duplicate email with 409', async () => {
      await authService.register({ name: 'Xander', email: 'dup@example.com', password: 'Passw0rd!' });
      await expect(
        authService.register({ name: 'Yara', email: 'dup@example.com', password: 'Passw0rd!' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('login', () => {
    it('returns tokens for the right password', async () => {
      await authService.register({ name: 'Grace', email: 'grace@example.com', password: 'Passw0rd!' });
      const r = await authService.login({ email: 'grace@example.com', password: 'Passw0rd!' });
      expect(r.accessToken).toBeDefined();
      expect(r.user.email).toBe('grace@example.com');
    });

    it('rejects bad password with 401 and the same message as unknown email', async () => {
      await authService.register({ name: 'Gina', email: 'g@example.com', password: 'Passw0rd!' });
      const wrongPwd = authService.login({ email: 'g@example.com', password: 'wrong-pw' }).catch((e) => e);
      const unknown  = authService.login({ email: 'who@example.com', password: 'x' }).catch((e) => e);
      const [a, b] = await Promise.all([wrongPwd, unknown]);
      expect(a.statusCode).toBe(401);
      expect(b.statusCode).toBe(401);
      expect(a.message).toBe(b.message); // no user-enumeration via different errors
    });

    it('rejects a blocked account with 403', async () => {
      await makeUser({ email: 'blocked@example.com', password: 'Passw0rd!', status: 'blocked' });
      await expect(
        authService.login({ email: 'blocked@example.com', password: 'Passw0rd!' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('rotateRefreshToken', () => {
    it('rotates the token and revokes the old jti', async () => {
      const reg = await authService.register({
        name: 'Rotator', email: 'r@example.com', password: 'Passw0rd!',
      });

      const rotated = await authService.rotateRefreshToken(reg.refreshToken);
      expect(rotated.refreshToken).not.toBe(reg.refreshToken);

      const tokens = await RefreshToken.find({ user: reg.user.id }).sort({ createdAt: 1 });
      expect(tokens).toHaveLength(2);
      expect(tokens[0].revokedAt).toBeTruthy();
      expect(tokens[0].replacedByJti).toBeTruthy();
      expect(tokens[1].revokedAt).toBeNull();
    });

    it('revokes the entire family if a revoked token is replayed', async () => {
      const reg = await authService.register({
        name: 'Rotator Two', email: 'r2@example.com', password: 'Passw0rd!',
      });
      // Rotate once — old token is now revoked.
      const rotated = await authService.rotateRefreshToken(reg.refreshToken);
      // Replay the original (revoked) token.
      await expect(authService.rotateRefreshToken(reg.refreshToken))
        .rejects.toMatchObject({ statusCode: 401 });
      // Every active token for this user should now be revoked.
      const active = await RefreshToken.find({ user: reg.user.id, revokedAt: null });
      expect(active).toHaveLength(0);
    });

    it('rejects garbage tokens with 401', async () => {
      await expect(authService.rotateRefreshToken('not.a.jwt'))
        .rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('changePassword', () => {
    it('updates the password and revokes all refresh tokens', async () => {
      const reg = await authService.register({
        name: 'Changer', email: 'c@example.com', password: 'OldPass1!',
      });

      await authService.changePassword(reg.user.id, {
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
      });

      const active = await RefreshToken.find({ user: reg.user.id, revokedAt: null });
      expect(active).toHaveLength(0);

      // Old password no longer works
      await expect(
        authService.login({ email: 'c@example.com', password: 'OldPass1!' })
      ).rejects.toMatchObject({ statusCode: 401 });
      // New does
      const ok = await authService.login({ email: 'c@example.com', password: 'NewPass1!' });
      expect(ok.accessToken).toBeDefined();
    });

    it('rejects wrong current password with 400', async () => {
      const reg = await authService.register({
        name: 'Changer Two', email: 'c2@example.com', password: 'OldPass1!',
      });
      await expect(
        authService.changePassword(reg.user.id, {
          currentPassword: 'wrong',
          newPassword: 'NewPass1!',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
