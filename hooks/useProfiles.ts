import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { assetUrl, discoverApi, type DiscoverPlayer, type SwipeAction } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { loadSportFilter, sportsQuery } from '@/lib/discoverFilters';
import { translate, useLanguage } from '@/lib/i18n';
import { MatchData, Profile } from '../types/database';

const QUERY_KEY = ['discover'] as const;
const PAGE = 20;

/** Server player → the Profile shape the card and the detail sheet already render. */
function toProfile(p: DiscoverPlayer, language: string): Profile {
  const photos = p.photos.map((u) => assetUrl(u)).filter((u): u is string => !!u);
  return {
    id: p.id,
    nama: p.name,
    age: p.age ?? undefined,
    umur: p.age ?? undefined,
    gender: p.gender ?? undefined,
    foto_url: photos[0] ?? '',
    photos,
    alamat: p.city ?? undefined,
    distance: p.distanceKm ?? undefined,
    // Sport ids (e.g. "badminton", "lari"); the UI translates them.
    hobi: p.sports.map((s) => s.sportId).join(', '),
    bio: p.bio ?? '',
    skill_level: p.skillLevel ?? undefined,
    availability: p.availability,
    pekerjaan: p.job ?? undefined,
    pendidikan: p.education ?? undefined,
    height_cm: p.heightCm ?? undefined,
    preferred_time: p.preferredTime ?? undefined,
    overall_frequency: p.playFrequency ?? undefined,
    home_venue: p.homeVenue ?? undefined,
    prompts: p.prompts.map((pr) => ({
      question_text: language === 'id' ? pr.question.id : pr.question.en,
      answer_text: pr.answer,
    })),
  };
}

const ACTION: Record<'left' | 'right' | 'up', SwipeAction> = { left: 'PASS', right: 'LIKE', up: 'SUPER' };

export function useProfiles() {
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const { language } = useLanguage();
  const [matchData, setMatchData] = useState<MatchData | null>(null);

  const fetchPage = async () => {
    const sports = sportsQuery(await loadSportFilter());
    const { items } = await discoverApi.list({ sports, limit: PAGE });
    return items.map((p) => toProfile(p, language));
  };

  const {
    data: profiles = [],
    isLoading: loading,
    error,
    refetch: fetchProfiles,
  } = useQuery({
    // Re-run when the account or the saved discovery preferences change.
    queryKey: [...QUERY_KEY, me?.id, me?.profile.ageMin, me?.profile.ageMax, me?.profile.maxDistanceKm, me?.profile.hasLocation],
    queryFn: fetchPage,
    enabled: !!me?.profile.onboardingCompleted,
  });

  const setDeck = (fn: (old: Profile[]) => Profile[]) =>
    queryClient.setQueriesData<Profile[]>({ queryKey: QUERY_KEY }, (old) => fn(old ?? []));

  // The deck holds one page. When it runs low, append the next one (people already swiped
  // are excluded server-side) without reordering what is on screen.
  const loadingMore = useRef(false);
  const loadMoreIfLow = async (left: number) => {
    if (left > 3 || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const fresh = await fetchPage();
      setDeck((old) => {
        const seen = new Set(old.map((p) => p.id));
        return [...old, ...fresh.filter((p) => !seen.has(p.id))];
      });
    } catch {
      // Keep the current deck; the next swipe tries again.
    } finally {
      loadingMore.current = false;
    }
  };

  const swipeMutation = useMutation({
    mutationFn: ({ profile, direction }: { profile: Profile; direction: 'left' | 'right' | 'up' }) =>
      discoverApi.swipe(profile.id, ACTION[direction]),
    onMutate: ({ profile }) => {
      // The card has already flown off; take it out of the deck right away.
      let left = 0;
      setDeck((old) => {
        const next = old.filter((p) => p.id !== profile.id);
        left = next.length;
        return next;
      });
      return { left };
    },
    onError: (_err, { profile }) => {
      // Put the card back on top so the swipe can be retried.
      setDeck((old) => (old.some((p) => p.id === profile.id) ? old : [profile, ...old]));
      Alert.alert(translate('discover.swipeFailedTitle'), translate('discover.swipeFailedBody'));
    },
    onSuccess: (res, { profile }, ctx) => {
      if (res.isMatch && res.matchId) {
        setMatchData({
          matchId: res.matchId,
          partnerId: res.partner.id,
          nama: res.partner.name || profile.nama,
          foto_url: assetUrl(res.partner.photoUrl) ?? profile.foto_url ?? null,
        });
      }
      loadMoreIfLow(ctx?.left ?? 0);
    },
  });

  const handleSwipeComplete = async (profile: Profile, direction: 'left' | 'right' | 'up') => {
    if (profile?.id) swipeMutation.mutate({ profile, direction });
  };

  return {
    profiles,
    loading,
    error,
    matchData,
    myAvatarUrl: assetUrl(me?.photos[0]?.url) ?? null,
    fetchProfiles,
    handleSwipeComplete,
    closeMatchModal: () => setMatchData(null),
  };
}
