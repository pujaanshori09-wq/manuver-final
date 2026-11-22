// Demo players for trying Discover on a development database. Never run this against production.
//   npm run db:seed:demo                 → (re)create demo players around the newest located account
//   npm run db:seed:demo -- -6.9 107.6   → around a given latitude / longitude
//   npm run db:seed:demo -- --remove     → delete every demo player
//
// Demo accounts use the reserved ".test" domain, have no password (nobody can sign in as them),
// and their photos are public Unsplash URLs. Half of them have already liked every real account,
// so inviting one of those shows the match screen.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo players in production');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const DEMO_DOMAIN = '@demo.manuver.test';
/** Bandung city centre, the first market, when no account has a location yet. */
const FALLBACK = { latitude: -6.9175, longitude: 107.6191 };

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

type Demo = {
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  city: string;
  /** km north / east of the centre. */
  offset: [number, number];
  sports: { id: string; level: string }[];
  skill: string;
  bio: string;
  availability: string[];
  photos: string[];
  likesYou: boolean;
  /** A community account: every 5th Discover card, a Like matches at once. */
  community?: boolean;
};

const DEMOS: Demo[] = [
  {
    name: 'Rina',
    age: 24,
    gender: 'FEMALE',
    city: 'Dago, Bandung',
    offset: [1.5, 0.8],
    sports: [{ id: 'badminton', level: '3-6 thn' }, { id: 'lari', level: '1-3 thn' }],
    skill: 'Intermediate',
    bio: 'Cari partner badminton santai atau sparring rutin tiap Sabtu pagi.',
    availability: ['Pagi', 'Akhir Pekan'],
    photos: [img('photo-1534528741775-53994a69daeb'), img('photo-1517841905240-472988babdf9')],
    likesYou: true,
  },
  {
    name: 'Reza',
    age: 27,
    gender: 'MALE',
    city: 'Buah Batu, Bandung',
    offset: [-2.5, 1.2],
    sports: [{ id: 'gym', level: '6+ thn' }, { id: 'basket', level: '3-6 thn' }],
    skill: 'Advanced',
    bio: 'Gym 4x seminggu dan basket santai akhir pekan. Cari gym buddy yang disiplin.',
    availability: ['Malam', 'Akhir Pekan'],
    photos: [img('photo-1506794778202-cad84cf45f1d'), img('photo-1581009146145-b5ef050c2e1e')],
    likesYou: false,
  },
  {
    name: 'Dinda',
    age: 25,
    gender: 'FEMALE',
    city: 'Cihampelas, Bandung',
    offset: [0.6, -1.4],
    sports: [{ id: 'yoga', level: '1-3 thn' }, { id: 'lari', level: '3-6 thn' }],
    skill: 'Intermediate',
    bio: 'Lari pagi lalu yoga. Lebih seru kalau ada teman yang konsisten.',
    availability: ['Pagi'],
    photos: [img('photo-1438761681033-6461ffad8d80'), img('photo-1506126613408-eca07ce68773')],
    likesYou: true,
  },
  {
    name: 'Bima',
    age: 29,
    gender: 'MALE',
    city: 'Antapani, Bandung',
    offset: [-0.8, 4.5],
    sports: [{ id: 'futsal', level: '6+ thn' }, { id: 'badminton', level: '1-3 thn' }],
    skill: 'Advanced',
    bio: 'Tim futsal kantor sering kurang satu pemain. Kabari kalau mau gabung.',
    availability: ['Malam'],
    photos: [img('photo-1500648767791-00dcc994a43e')],
    likesYou: true,
  },
  {
    name: 'Sari',
    age: 23,
    gender: 'FEMALE',
    city: 'Lembang',
    offset: [9, 1],
    sports: [{ id: 'sepeda', level: '1-3 thn' }, { id: 'hiking', level: '< 6 bln' }],
    skill: 'Beginner',
    bio: 'Gowes ke Lembang tiap Minggu. Pemula, tapi semangat!',
    availability: ['Akhir Pekan'],
    photos: [img('photo-1544005313-94ddf0286df2')],
    likesYou: false,
  },
  {
    name: 'Adit',
    age: 31,
    gender: 'MALE',
    city: 'Sukajadi, Bandung',
    offset: [2.2, -2.6],
    sports: [{ id: 'tenis', level: '6+ thn' }, { id: 'padel', level: '6 bln-1 thn' }],
    skill: 'Advanced',
    bio: 'Main tenis 10 tahun, baru coba padel. Cari lawan rally yang seimbang.',
    availability: ['Pagi', 'Sore'],
    photos: [img('photo-1507003211169-0a1dd7228f2d')],
    likesYou: true,
  },
  {
    name: 'Nadia',
    age: 26,
    gender: 'FEMALE',
    city: 'Cimahi',
    offset: [-1, -11],
    sports: [{ id: 'renang', level: '3-6 thn' }, { id: 'gym', level: '1-3 thn' }],
    skill: 'Intermediate',
    bio: 'Renang pagi sebelum kerja. Butuh teman biar nggak bolos.',
    availability: ['Pagi'],
    photos: [img('photo-1531123897727-8f129e1688ce')],
    likesYou: false,
  },
  {
    name: 'Fajar',
    age: 22,
    gender: 'MALE',
    city: 'Jatinangor',
    offset: [-6, 18],
    sports: [{ id: 'voli', level: '1-3 thn' }, { id: 'futsal', level: '1-3 thn' }],
    skill: 'Beginner',
    bio: 'Mahasiswa, sering main voli sore di kampus. Ayo ramaikan!',
    availability: ['Sore', 'Akhir Pekan'],
    photos: [img('photo-1539571696357-5a69c17a67c6')],
    likesYou: false,
  },
  {
    name: 'Bandung Runners',
    age: 30,
    gender: 'OTHER',
    city: 'Bandung',
    offset: [2, -1],
    sports: [{ id: 'lari', level: '6+ thn' }],
    skill: 'Semua level',
    bio: 'Komunitas lari Bandung. Lari bareng tiap Selasa malam & Minggu pagi, semua pace diterima.',
    availability: ['Malam', 'Akhir Pekan'],
    photos: [img('photo-1452626038306-9aae5e071dd3')],
    likesYou: false,
    community: true,
  },
  {
    name: 'Smash Badminton Club',
    age: 30,
    gender: 'OTHER',
    city: 'Bandung',
    offset: [-1, 2],
    sports: [{ id: 'badminton', level: '6+ thn' }],
    skill: 'Semua level',
    bio: 'Main badminton bareng tiap Rabu & Sabtu. Gabung, kenalan, langsung main.',
    availability: ['Malam', 'Akhir Pekan'],
    photos: [img('photo-1626224583764-f87db24ac4ea')],
    likesYou: false,
    community: true,
  },
];

const PROMPT_ANSWERS = [
  'Konsisten latihan 3x seminggu tanpa bolos.',
  'Yang datang tepat waktu dan nggak gampang cancel.',
  'Habis main lanjut ngopi atau makan bareng.',
];

function bornYearsAgo(age: number) {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear() - age, 0, 1));
}

async function centre(args: string[]) {
  const nums = args.map(Number).filter((n) => Number.isFinite(n));
  if (nums.length >= 2) return { latitude: nums[0]!, longitude: nums[1]! };
  const located = await prisma.profile.findFirst({
    where: { latitude: { not: null }, longitude: { not: null }, user: { email: { not: { endsWith: DEMO_DOMAIN } } } },
    orderBy: { locationUpdatedAt: 'desc' },
    select: { latitude: true, longitude: true },
  });
  return located?.latitude != null && located.longitude != null
    ? { latitude: located.latitude, longitude: located.longitude }
    : FALLBACK;
}

async function removeDemos() {
  const { count } = await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_DOMAIN } } });
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  const removed = await removeDemos();
  if (args.includes('--remove')) {
    console.log(`Removed ${removed} demo players`);
    return;
  }

  const c = await centre(args);
  const kmLat = 1 / 111;
  const kmLon = 1 / (111 * Math.cos((c.latitude * Math.PI) / 180));
  const questions = await prisma.promptQuestion.findMany({ where: { isActive: true }, take: 3, orderBy: { textEn: 'asc' } });
  const realUsers = await prisma.user.findMany({
    where: { email: { not: { endsWith: DEMO_DOMAIN } }, profile: { onboardingCompletedAt: { not: null } } },
    select: { id: true },
  });
  const now = new Date();

  for (const [i, d] of DEMOS.entries()) {
    const user = await prisma.user.create({
      data: {
        email: `demo${i + 1}${DEMO_DOMAIN}`,
        profile: {
          create: {
            name: d.name,
            language: 'ID',
            birthDate: bornYearsAgo(d.age),
            gender: d.gender,
            genderPreference: 'ALL',
            ageMin: 18,
            ageMax: 60,
            maxDistanceKm: 50,
            city: d.city,
            bio: d.bio,
            skillLevel: d.skill,
            availability: d.availability,
            latitude: c.latitude + d.offset[0] * kmLat,
            longitude: c.longitude + d.offset[1] * kmLon,
            locationUpdatedAt: now,
            termsAcceptedAt: now,
            onboardingCompletedAt: now,
            isCommunity: d.community ?? false,
            lastActiveAt: new Date(now.getTime() - i * 60_000),
          },
        },
        photos: { create: d.photos.map((storageKey, position) => ({ storageKey, position })) },
        sports: { create: d.sports.map((s) => ({ sportId: s.id, experienceLevel: s.level })) },
        prompts: {
          create: questions.slice(0, 2).map((q, position) => ({
            questionId: q.id,
            answer: PROMPT_ANSWERS[(i + position) % PROMPT_ANSWERS.length]!,
            position,
          })),
        },
      },
      select: { id: true },
    });
    if (d.likesYou && realUsers.length) {
      await prisma.swipe.createMany({
        data: realUsers.map((u) => ({ userId: user.id, targetId: u.id, action: 'LIKE' as const })),
        skipDuplicates: true,
      });
    }
  }

  // A few approved events (the Explore tab), hosted by a demo player so --remove clears them too.
  const host = await prisma.user.findFirstOrThrow({ where: { email: { endsWith: DEMO_DOMAIN } }, select: { id: true } });
  const day = 86_400_000;
  await prisma.event.createMany({
    data: [
      { title: 'Bandung Night Run 10K', organizer: 'Komunitas Lari Bandung', type: 'Fun Run', category: 'Running', startsAt: new Date(now.getTime() + 12 * day), location: 'Gedung Sate', city: 'Bandung', priceIdr: 150000, quota: 500, imageUrl: img('photo-1452626038306-9aae5e071dd3'), isFeatured: true },
      { title: 'Badminton Open GBK Cup', organizer: 'PBSI DKI Jakarta', type: 'Open Tournament', category: 'Badminton', startsAt: new Date(now.getTime() + 20 * day), location: 'Istora Senayan', city: 'Jakarta', priceIdr: 150000, quota: 320, imageUrl: img('photo-1626224583764-f87db24ac4ea') },
      { title: 'Padel Americano Sabtu Pagi', organizer: 'Padel Dago', type: 'Komunitas', category: 'Padel', startsAt: new Date(now.getTime() + 4 * day), location: 'Padel Dago Club', city: 'Bandung', priceIdr: 0, quota: 16, imageUrl: img('photo-1554068865-24cecd4e34b8') },
    ].map((e) => ({ ...e, creatorId: host.id, status: 'APPROVED' as const })),
  });

  console.log(
    `Created ${DEMOS.length} demo players around ${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}` +
      ` (${DEMOS.filter((d) => d.likesYou).length} already like ${realUsers.length} real account(s))`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
