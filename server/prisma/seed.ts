// Seeds reference data (safe to run repeatedly): prompt questions in English and Indonesian.
//   npm run db:seed
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const QUESTIONS: { en: string; id: string; category: string }[] = [
  { category: 'goals', en: 'My sports goal this month', id: 'Target olahragaku bulan ini' },
  { category: 'goals', en: "A record I'm chasing", id: 'Rekor yang sedang kukejar' },
  { category: 'partner', en: 'My ideal sparring partner', id: 'Partner sparing idealku' },
  { category: 'partner', en: "I'll invite you to play if…", id: 'Aku bakal ajak kamu main kalau…' },
  { category: 'style', en: 'My favourite way to train', id: 'Gaya latihan favoritku' },
  { category: 'style', en: 'Morning or evening session?', id: 'Sesi pagi atau malam?' },
  { category: 'style', en: 'After the game we usually…', id: 'Habis main biasanya kita…' },
  { category: 'fun', en: 'My go-to court or track', id: 'Lapangan atau rute andalanku' },
  { category: 'fun', en: 'The sport I want to learn next', id: 'Olahraga yang ingin kupelajari berikutnya' },
  { category: 'fun', en: 'My most memorable match', id: 'Pertandingan paling berkesan' },
];

async function main() {
  for (const q of QUESTIONS) {
    const existing = await prisma.promptQuestion.findFirst({ where: { textEn: q.en } });
    if (existing) {
      await prisma.promptQuestion.update({ where: { id: existing.id }, data: { textId: q.id, category: q.category, isActive: true } });
    } else {
      await prisma.promptQuestion.create({ data: { textEn: q.en, textId: q.id, category: q.category } });
    }
  }
  console.log(`Seeded ${QUESTIONS.length} prompt questions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
