import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { bucketStorage, type S3Like } from '../src/lib/storage.js';

/** Records every command and answers list requests from a fake bucket. */
function fakeBucket(keys: string[]) {
  const sent: { name: string; input: Record<string, unknown> }[] = [];
  const client: S3Like = {
    send: (async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sent.push({ name: cmd.constructor.name, input: cmd.input });
      if (cmd.constructor.name === 'ListObjectsV2Command') {
        // Two pages: the first two keys, then the rest.
        const second = cmd.input.ContinuationToken === 'page-2';
        const page = second ? keys.slice(2) : keys.slice(0, 2);
        return { Contents: page.map((Key) => ({ Key })), IsTruncated: !second && keys.length > 2, NextContinuationToken: 'page-2' };
      }
      return {};
    }) as S3Like['send'],
  };
  return { client, sent };
}

describe('bucket storage (Cloudflare R2)', () => {
  it('uploads with the right type and a long cache, and links to the public domain', async () => {
    const { client, sent } = fakeBucket([]);
    const store = bucketStorage(client, 'manuver-photos', 'https://photos.manuver.app/');
    const key = await store.save('users/u1', Buffer.from('jpeg bytes'), 'jpg');

    expect(key).toMatch(/^users\/u1\/[0-9a-f-]{36}\.jpg$/);
    expect(sent).toEqual([
      {
        name: 'PutObjectCommand',
        input: expect.objectContaining({
          Bucket: 'manuver-photos',
          Key: key,
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      },
    ]);
    expect(store.url(key)).toBe(`https://photos.manuver.app/${key}`);
    expect(store.url('https://images.unsplash.com/demo.jpg')).toBe('https://images.unsplash.com/demo.jpg');
  });

  it("deletes one photo, or all of an account's photos page by page", async () => {
    const { client, sent } = fakeBucket(['users/u1/a.jpg', 'users/u1/b.jpg', 'users/u1/c.jpg']);
    const store = bucketStorage(client, 'b', 'https://p');
    await store.remove('users/u1/a.jpg');
    await store.remove('https://images.unsplash.com/demo.jpg'); // not ours: nothing to delete
    await store.removePrefix('users/u1');

    expect(sent.map((s) => s.name)).toEqual([
      'DeleteObjectCommand',
      'ListObjectsV2Command',
      'DeleteObjectsCommand',
      'ListObjectsV2Command',
      'DeleteObjectsCommand',
    ]);
    expect(sent[1]!.input.Prefix).toBe('users/u1/'); // never "users/u10…"
    const deleted = sent.filter((s) => s.name === 'DeleteObjectsCommand').flatMap((s) => (s.input.Delete as { Objects: { Key: string }[] }).Objects);
    expect(deleted.map((o) => o.Key)).toEqual(['users/u1/a.jpg', 'users/u1/b.jpg', 'users/u1/c.jpg']);
  });
});

describe('production configuration', () => {
  const good = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@db.example.com:5432/manuver',
    JWT_ACCESS_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: 'b'.repeat(48),
    PUBLIC_BASE_URL: 'https://api.manuver.app',
    RESEND_API_KEY: 're_test_key',
    STORAGE_DRIVER: 's3',
    S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
    S3_BUCKET: 'manuver-photos',
    S3_ACCESS_KEY_ID: 'key',
    S3_SECRET_ACCESS_KEY: 'secret',
    S3_PUBLIC_URL: 'https://photos.manuver.app',
  };

  it('accepts a complete setup', () => {
    expect(parseEnv(good)).toMatchObject({ NODE_ENV: 'production', STORAGE_DRIVER: 's3', S3_REGION: 'auto', S3_FORCE_PATH_STYLE: false });
  });

  it('takes Supabase Storage, which wants path-style requests', () => {
    const supabase = parseEnv({
      ...good,
      S3_ENDPOINT: 'https://abcd.supabase.co/storage/v1/s3',
      S3_REGION: 'ap-southeast-1',
      S3_PUBLIC_URL: 'https://abcd.supabase.co/storage/v1/object/public/manuver-photos',
      S3_FORCE_PATH_STYLE: 'true',
    });
    expect(supabase.S3_FORCE_PATH_STYLE).toBe(true);
    expect(() => parseEnv({ ...good, S3_FORCE_PATH_STYLE: 'yes' })).toThrow(/S3_FORCE_PATH_STYLE/);
  });

  it('refuses the example secrets, a shared secret and a plain-http address', () => {
    expect(() => parseEnv({ ...good, JWT_ACCESS_SECRET: 'change-me-access-secret-at-least-32-characters' })).toThrow(/example value/);
    expect(() => parseEnv({ ...good, JWT_REFRESH_SECRET: good.JWT_ACCESS_SECRET })).toThrow(/two different/);
    expect(() => parseEnv({ ...good, PUBLIC_BASE_URL: 'http://api.manuver.app' })).toThrow(/https/);
    expect(() => parseEnv({ ...good, RESEND_API_KEY: '' })).toThrow(/RESEND_API_KEY/);
  });

  it('names every missing bucket setting', () => {
    const { S3_BUCKET: _b, S3_PUBLIC_URL: _p, ...rest } = good;
    expect(() => parseEnv(rest)).toThrow(/S3_BUCKET[\s\S]*S3_PUBLIC_URL/);
  });

  it('lets development run with the example values and local disk', () => {
    expect(
      parseEnv({ DATABASE_URL: good.DATABASE_URL, JWT_ACCESS_SECRET: 'change-me-access-secret-at-least-32-characters', JWT_REFRESH_SECRET: 'change-me-refresh-secret-at-least-32-characters' }),
    ).toMatchObject({ NODE_ENV: 'development', STORAGE_DRIVER: 'local' });
  });
});
