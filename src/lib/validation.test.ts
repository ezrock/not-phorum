import { describe, expect, it } from 'vitest';
import { getFirstValidationError, rules, validate } from '@/lib/validation';

describe('validation rules', () => {
  it('required + minLength + pattern validate in order and stop at first error', () => {
    const values = { username: '' };
    const errors = validate(values, {
      username: [
        rules.required('required'),
        rules.minLength(3, 'min'),
        rules.pattern(/^[a-z0-9_]+$/i, 'pattern'),
      ],
    });
    expect(errors.username).toBe('required');
  });

  it('equalsField validates matching values', () => {
    const values = { password: 'Secret123', confirmPassword: 'Secret1234' };
    const errors = validate(values, {
      confirmPassword: [rules.equalsField('password', 'no-match')],
    });
    expect(errors.confirmPassword).toBe('no-match');
  });

  it('custom rule receives full values object', () => {
    const values = { role: 'user', username: 'ab' };
    const errors = validate(values, {
      username: [
        rules.custom(
          (value, all) => all.role !== 'admin' || String(value).length >= 3,
          'admin-min-3'
        ),
      ],
    });
    expect(errors).toEqual({});
  });

  it('passwordStrong enforces upper/lower/digit', () => {
    const weak = validate(
      { password: 'abcxyz' },
      { password: [rules.passwordStrong('weak')] }
    );
    const strong = validate(
      { password: 'Abcxyz1' },
      { password: [rules.passwordStrong('weak')] }
    );
    expect(weak.password).toBe('weak');
    expect(strong.password).toBeUndefined();
  });

  it('httpUrlOptional accepts empty + http/https and rejects invalid protocols', () => {
    const empty = validate({ url: '   ' }, { url: [rules.httpUrlOptional('bad-url')] });
    const httpOk = validate({ url: 'http://example.com' }, { url: [rules.httpUrlOptional('bad-url')] });
    const httpsOk = validate({ url: 'https://example.com/path' }, { url: [rules.httpUrlOptional('bad-url')] });
    const invalid = validate({ url: 'ftp://example.com' }, { url: [rules.httpUrlOptional('bad-url')] });

    expect(empty.url).toBeUndefined();
    expect(httpOk.url).toBeUndefined();
    expect(httpsOk.url).toBeUndefined();
    expect(invalid.url).toBe('bad-url');
  });
});

describe('getFirstValidationError', () => {
  it('returns first message or null for no errors', () => {
    expect(getFirstValidationError({ username: 'bad', email: 'also-bad' })).toBe('bad');
    expect(getFirstValidationError({})).toBeNull();
  });
});
