import bcrypt from 'bcryptjs';

// 12 rounds ≈ 250 ms on a laptop: slow for attackers, fine for one login.
const ROUNDS = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// When the email does not exist we still run one bcrypt comparison, so response time
// does not reveal which emails are registered. The hash is real (computed once).
let dummyHash: Promise<string> | null = null;
export function burnPasswordCheck(plain: string): Promise<boolean> {
  dummyHash ??= bcrypt.hash('manuver-timing-equalizer', ROUNDS);
  return dummyHash.then((h) => bcrypt.compare(plain, h));
}
