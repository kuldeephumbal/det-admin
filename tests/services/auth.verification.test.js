const crypto = require('crypto');
const authService = require('../../lib/services/auth.service');
const User = require('../../lib/models/User');
const { ensureDb, makeUser } = require('../helpers');

beforeAll(ensureDb);

const sha256 = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// Reach into the User collection for the raw verification fields,
// which are select:false and absent from sanitize().
const readVerification = (userId) =>
  User.findById(userId)
    .select(
      '+emailVerificationToken +emailVerificationExpires +emailVerificationSentAt'
    )
    .lean();

describe('auth.service — email verification', () => {
  describe('register', () => {
    it('writes a hashed verification token on signup', async () => {
      const reg = await authService.register({
        name: 'V User',
        email: 'verify@example.com',
        password: 'Passw0rd!',
      });
      expect(reg.user.emailVerifiedAt).toBeNull();

      const stored = await readVerification(reg.user.id);
      expect(stored.emailVerificationToken).toEqual(expect.any(String));
      expect(stored.emailVerificationToken).toHaveLength(64); // sha256 hex
      expect(stored.emailVerificationExpires.getTime()).toBeGreaterThan(Date.now());
      expect(stored.emailVerificationSentAt).toBeInstanceOf(Date);
    });
  });

  describe('verifyEmail', () => {
    it('marks the user verified when given the matching raw token', async () => {
      const user = await makeUser({ email: 'v1@example.com' });
      // sendVerification persists a fresh token for an existing user.
      await authService.sendVerification(String(user._id));

      // Pull the hashed token, brute-force-test a known raw is impossible —
      // we go via a second sendVerification with cooldown bypass instead:
      // simpler approach: clear cooldown then call _issueVerificationToken via sendVerification by
      // backdating sentAt. We'll reset and capture via mailer is overkill — instead, we mint
      // a token straight on the doc to avoid coupling to mailer fixtures.
      const raw = crypto.randomBytes(32).toString('hex');
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            emailVerificationToken: sha256(raw),
            emailVerificationExpires: new Date(Date.now() + 60_000),
          },
        }
      );

      const result = await authService.verifyEmail({ token: raw });
      expect(result.user.emailVerifiedAt).toBeInstanceOf(Date);

      const stored = await readVerification(user._id);
      expect(stored.emailVerifiedAt).toBeInstanceOf(Date);
      expect(stored.emailVerificationToken).toBeUndefined();
      expect(stored.emailVerificationExpires).toBeUndefined();
    });

    it('rejects an unknown token with 400', async () => {
      await expect(
        authService.verifyEmail({ token: 'a'.repeat(64) })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects an expired token with 400', async () => {
      const user = await makeUser({ email: 'expired@example.com' });
      const raw = crypto.randomBytes(32).toString('hex');
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            emailVerificationToken: sha256(raw),
            emailVerificationExpires: new Date(Date.now() - 1000),
          },
        }
      );

      await expect(
        authService.verifyEmail({ token: raw })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('consumes the token — verifying twice with the same token fails the second time', async () => {
      const user = await makeUser({ email: 'twice@example.com' });
      const raw = crypto.randomBytes(32).toString('hex');
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            emailVerificationToken: sha256(raw),
            emailVerificationExpires: new Date(Date.now() + 60_000),
          },
        }
      );

      await authService.verifyEmail({ token: raw });
      await expect(
        authService.verifyEmail({ token: raw })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('sendVerification', () => {
    it('issues a fresh token for an unverified user', async () => {
      const reg = await authService.register({
        name: 'Send Verify',
        email: 's@example.com',
        password: 'Passw0rd!',
      });
      const before = await readVerification(reg.user.id);

      // Bypass cooldown by backdating sentAt.
      await User.updateOne(
        { _id: reg.user.id },
        { $set: { emailVerificationSentAt: new Date(Date.now() - 5 * 60 * 1000) } }
      );

      const result = await authService.sendVerification(reg.user.id);
      expect(result.alreadyVerified).toBe(false);

      const after = await readVerification(reg.user.id);
      expect(after.emailVerificationToken).not.toBe(before.emailVerificationToken);
      expect(after.emailVerificationSentAt.getTime()).toBeGreaterThan(
        before.emailVerificationSentAt.getTime()
      );
    });

    it('returns alreadyVerified when emailVerifiedAt is set', async () => {
      const user = await makeUser({
        email: 'already@example.com',
        emailVerifiedAt: new Date(),
      });
      const result = await authService.sendVerification(String(user._id));
      expect(result.alreadyVerified).toBe(true);
    });

    it('enforces the resend cooldown', async () => {
      const reg = await authService.register({
        name: 'CD',
        email: 'cd@example.com',
        password: 'Passw0rd!',
      });
      // Immediately resending should hit the cooldown set during register.
      await expect(
        authService.sendVerification(reg.user.id)
      ).rejects.toMatchObject({ statusCode: 429 });
    });
  });
});
