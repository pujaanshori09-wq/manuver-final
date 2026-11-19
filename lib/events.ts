import type { SportEvent } from '@/lib/api';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=80';

/** A server event with the display strings the Explore cards and the detail screen show. */
export function eventDisplay(e: SportEvent, language: string, free: string) {
  const starts = new Date(e.startsAt);
  return {
    ...e,
    image: e.imageUrl ?? FALLBACK_IMAGE,
    date: starts.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' }),
    dateTime: starts.toLocaleString(language, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    price: e.priceIdr > 0 ? `Rp ${e.priceIdr.toLocaleString('id-ID')}` : free,
    participants: e.quota ? `${e.registrations}/${e.quota}` : `${e.registrations}`,
  };
}

export type EventDisplay = ReturnType<typeof eventDisplay>;
