import { Platform } from 'react-native';
import { api, ApiError, storeTokens, type TokenPair } from './client';
import { getApiBaseUrl } from './config';
import { clearTokens, getRefreshToken } from './tokens';

export { ApiError, api, onSessionExpired, refreshSession } from './client';
export { assetUrl, getApiBaseUrl } from './config';

// ── Types (mirror server/src/modules/*) ──────────────────────────────────────────

export type GenderPreference = 'ALL' | 'MEN' | 'WOMEN';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type AppLanguage = 'EN' | 'ID' | 'ZH' | 'ES' | 'HI' | 'PT' | 'RU' | 'JA' | 'DE' | 'FR' | 'KO' | 'VI' | 'TH' | 'MS';

export type MeProfile = {
  name: string;
  language: AppLanguage | null;
  birthDate: string | null;
  age: number | null;
  gender: Gender | null;
  bio: string | null;
  lookingFor: string | null;
  skillLevel: string | null;
  job: string | null;
  education: string | null;
  city: string | null;
  heightCm: number | null;
  workoutStyle: string | null;
  preferredTime: string | null;
  playFrequency: string | null;
  homeVenue: string | null;
  availability: string[];
  ageMin: number;
  ageMax: number;
  genderPreference: GenderPreference;
  maxDistanceKm: number;
  ghostMode: boolean;
  hasLocation: boolean;
  termsAccepted: boolean;
  onboardingCompleted: boolean;
};

export type Photo = { id: string; url: string; position: number };
export type UserSport = { sportId: string; experienceLevel: string | null };
export type MyPrompt = { questionId: string; question: { en: string; id: string }; answer: string; position: number };

export type Me = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  profile: MeProfile;
  photos: Photo[];
  sports: UserSport[];
  prompts: MyPrompt[];
  stats: { sessionsJoined: number; matches: number };
};

export type PromptQuestion = { id: string; category: string | null; text: { en: string; id: string } };

export type AuthUser = { id: string; email: string | null; emailVerified: boolean; onboardingCompleted: boolean };
type AuthResponse = TokenPair & { user: AuthUser; isNewUser?: boolean };


// ── Auth ────────────────────────────────────────────────────────────────────────

export const authApi = {
  async register(email: string, password: string, name?: string) {
    const res = await api<AuthResponse>('/v1/auth/register', { body: { email, password, name }, auth: false });
    await storeTokens(res);
    return res.user;
  },
  async login(email: string, password: string) {
    const res = await api<AuthResponse>('/v1/auth/login', { body: { email, password }, auth: false });
    await storeTokens(res);
    return res.user;
  },
  async google(idToken: string) {
    const res = await api<AuthResponse>('/v1/auth/google', { body: { idToken }, auth: false });
    await storeTokens(res);
    return res.user;
  },
  async logout() {
    const refreshToken = await getRefreshToken();
    await clearTokens();
    if (refreshToken) {
      await api('/v1/auth/logout', { body: { refreshToken }, auth: false }).catch(() => {});
    }
  },
  /** Server-side Google OAuth: URL to open in the browser. */
  googleStartUrl: (returnUrl: string) => {
    const origin = getApiBaseUrl();
    return `${origin}/v1/auth/google/start?${new URLSearchParams({ origin, returnUrl })}`;
  },
  /** Swaps the one-time code Google's redirect brought back for a session. */
  async googleExchange(code: string) {
    const res = await api<AuthResponse>('/v1/auth/google/exchange', { body: { code }, auth: false });
    await storeTokens(res);
    return res;
  },
  /** `returnUrl`: the app screen the emailed link should open (reset-password). */
  forgotPassword: (email: string, returnUrl?: string) =>
    api('/v1/auth/password/forgot', { body: { email, returnUrl }, auth: false }),
  resetPassword: (token: string, password: string) =>
    api('/v1/auth/password/reset', { body: { token, password }, auth: false }),
};

// ── Me ──────────────────────────────────────────────────────────────────────────

export type ProfilePatch = Partial<
  Pick<
    MeProfile,
    | 'name'
    | 'bio'
    | 'lookingFor'
    | 'skillLevel'
    | 'job'
    | 'education'
    | 'city'
    | 'heightCm'
    | 'workoutStyle'
    | 'preferredTime'
    | 'playFrequency'
    | 'homeVenue'
    | 'availability'
    | 'ageMin'
    | 'ageMax'
    | 'genderPreference'
    | 'maxDistanceKm'
    | 'ghostMode'
    | 'language'
  >
>;

export type OnboardingInput = {
  name: string;
  birthDate: string; // YYYY-MM-DD
  gender: Gender;
  genderPreference: GenderPreference;
  ageMin: number;
  ageMax: number;
  language: AppLanguage;
  sports: { sportId: string; experienceLevel?: string | null }[];
  acceptTerms: true;
  location?: { latitude: number; longitude: number };
};

export const meApi = {
  get: () => api<Me>('/v1/me'),
  updateProfile: (patch: ProfilePatch) => api<Me>('/v1/me/profile', { method: 'PATCH', body: patch }),
  setSports: (sports: { sportId: string; experienceLevel?: string | null }[]) =>
    api<Me>('/v1/me/sports', { method: 'PUT', body: { sports } }),
  setLocation: (latitude: number, longitude: number) =>
    api('/v1/me/location', { method: 'PUT', body: { latitude, longitude } }),
  completeOnboarding: (input: OnboardingInput) => api<Me>('/v1/me/onboarding', { body: input }),
  /** `uri` from expo-image-picker. */
  uploadPhoto(uri: string, mimeType = 'image/jpeg') {
    const form = new FormData();
    const ext = mimeType.split('/')[1] ?? 'jpg';
    if (Platform.OS === 'web') {
      // On the web the picker gives a blob/data URL; fetch it into a Blob first.
      return fetch(uri)
        .then((r) => r.blob())
        .then((blob) => {
          form.append('photo', blob, `photo.${ext}`);
          return api<Me>('/v1/me/photos', { form });
        });
    }
    // React Native's FormData accepts { uri, name, type } file descriptors.
    form.append('photo', { uri, name: `photo.${ext}`, type: mimeType } as unknown as Blob);
    return api<Me>('/v1/me/photos', { form });
  },
  deletePhoto: (id: string) => api<Me>(`/v1/me/photos/${id}`, { method: 'DELETE' }),
  reorderPhotos: (ids: string[]) => api<Me>('/v1/me/photos/order', { method: 'PUT', body: { ids } }),
  setPrompts: (prompts: { questionId: string; answer: string }[]) =>
    api<Me>('/v1/me/prompts', { method: 'PUT', body: { prompts } }),
  promptQuestions: () => api<PromptQuestion[]>('/v1/prompts/questions'),
  deleteAccount: () => api('/v1/me', { method: 'DELETE' }),
  /** This phone's Expo push token (pushes are sent by the server only). */
  setPushToken: (token: string) => api('/v1/me/push-token', { method: 'PUT', body: { token } }),
  removePushToken: (token: string) => api('/v1/me/push-token', { method: 'DELETE', body: { token } }),
};

// ── Safety: blocking and reporting (server/src/modules/safety) ───────────────────

export type ReportReason = 'RUDE' | 'SPAM' | 'FAKE' | 'INAPPROPRIATE' | 'UNDERAGE' | 'OTHER';
export type BlockedPlayer = { id: string; name: string; photoUrl: string | null; blockedAt: string };

export const safetyApi = {
  block: (userId: string) => api('/v1/blocks', { body: { userId } }),
  unblock: (userId: string) => api(`/v1/blocks/${userId}`, { method: 'DELETE' }),
  blocked: () => api<BlockedPlayer[]>('/v1/blocks'),
  report: (userId: string, reason: ReportReason, details?: string) =>
    api<{ id: string }>('/v1/reports', { body: { userId, reason, ...(details ? { details } : {}) } }),
};

// ── Discover & swipes (server/src/modules/discover) ─────────────────────────────

export type DiscoverPlayer = {
  /** A community account (every 5th card); a Like there is a match straight away. */
  isCommunity: boolean;
  id: string;
  name: string;
  age: number | null;
  gender: Gender | null;
  city: string | null;
  /** Rounded up to whole km; null when either side has no location. */
  distanceKm: number | null;
  bio: string | null;
  lookingFor: string | null;
  skillLevel: string | null;
  job: string | null;
  education: string | null;
  heightCm: number | null;
  workoutStyle: string | null;
  preferredTime: string | null;
  playFrequency: string | null;
  homeVenue: string | null;
  availability: string[];
  /** Relative "/uploads/…" paths (or absolute demo URLs); pass through assetUrl(). */
  photos: string[];
  sports: { sportId: string; experienceLevel: string | null }[];
  prompts: { question: { en: string; id: string }; answer: string }[];
};

export type SwipeAction = 'LIKE' | 'PASS' | 'SUPER';

/** What is left of the swipe allowance (server/src/modules/discover/quota.ts decides). */
export type SwipeQuota = {
  premium: boolean;
  /** null = unlimited (premium). */
  likesLeft: number | null;
  likesResetAt: string;
  superLeft: number;
  superResetAt: string;
};

/** Why a swipe was refused (HTTP 429), for the quota sheet. */
export type SwipeLimit = { kind: 'like' | 'super' | 'rate'; resetsAt: string };

/** Reads a refused swipe; null for any other error. */
export function swipeLimitFrom(e: unknown): SwipeLimit | null {
  if (!(e instanceof ApiError) || e.status !== 429) return null;
  const d = e.details as unknown as { kind?: string; resetsAt?: string } | undefined;
  if (!d?.resetsAt) return null;
  if (e.code === 'swipe_rate_limited') return { kind: 'rate', resetsAt: d.resetsAt };
  if (e.code === 'swipe_limit_reached') return { kind: d.kind === 'super' ? 'super' : 'like', resetsAt: d.resetsAt };
  return null;
}

export type SwipeResult = {
  isMatch: boolean;
  matchId: string | null;
  partner: { id: string; name: string; photoUrl: string | null };
  quota: SwipeQuota;
};

export const discoverApi = {
  /** Age and distance come from the saved profile; `sports` narrows the feed when given. */
  /** `ahead` = cards the app still holds, so community cards stay on every 5th swipe. */
  list: (opts: { sports?: string[]; limit?: number; ahead?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.limit) q.set('limit', String(opts.limit));
    if (opts.ahead) q.set('ahead', String(opts.ahead));
    if (opts.sports?.length) q.set('sports', opts.sports.join(','));
    const qs = q.toString();
    return api<{ items: DiscoverPlayer[]; quota: SwipeQuota }>(`/v1/discover${qs ? `?${qs}` : ''}`);
  },
  swipe: (targetId: string, action: SwipeAction) => api<SwipeResult>('/v1/swipes', { body: { targetId, action } }),
};

// ── Chat (server/src/modules/chat) ──────────────────────────────────────────────

export type ChatInvite = { sport: string; venueName: string; scheduledAt: string; note: string | null };

export type ChatMessage = {
  id: string;
  matchId: string;
  senderId: string;
  type: 'TEXT' | 'SPARING_INVITE';
  content: string;
  invite: ChatInvite | null;
  inviteStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
  clientId: string | null;
  createdAt: string;
};

export type ChatSummary = {
  id: string;
  createdAt: string;
  partner: { id: string; name: string; photoUrl: string | null };
  lastMessage: { content: string; type: ChatMessage['type']; senderId: string; createdAt: string } | null;
  unreadCount: number;
};

export const chatApi = {
  list: () => api<ChatSummary[]>('/v1/matches'),
  messages: (matchId: string) => api<ChatMessage[]>(`/v1/matches/${matchId}/messages`),
  send: (
    matchId: string,
    body: { clientId: string; type: 'TEXT'; content: string } | { clientId: string; type: 'SPARING_INVITE'; content: string; invite: ChatInvite },
  ) => api<ChatMessage>(`/v1/matches/${matchId}/messages`, { body }),
  respond: (messageId: string, status: 'ACCEPTED' | 'DECLINED') =>
    api<ChatMessage>(`/v1/messages/${messageId}/respond`, { body: { status } }),
};

// ── Activities & public profiles (server/src/modules/activities) ───────────────

export type Activity = {
  id: string;
  userId: string;
  type: 'RUN' | 'RIDE' | 'HIKE';
  title: string;
  startedAt: string;
  endedAt: string;
  movingSec: number;
  distanceM: number;
  showOnProfile: boolean;
  /** Encoded polyline. Other people get it with the first and last 200 m cut off. */
  route: string;
  /** Owner only: anyone with the link can view it. */
  isPublic?: boolean;
  publicUrl?: string | null;
  /** Detail only: speed along the route as [metres from start, km/h] (pauses left out). */
  speed?: { points: [number, number][]; maxKmh: number } | null;
};

export type NewActivity = Omit<Activity, 'id' | 'userId' | 'route' | 'isPublic' | 'publicUrl' | 'speed'> & {
  clientId: string;
  polyline: string;
  /** Seconds since startedAt for each polyline point. */
  pointTimes: number[];
  /** Indices of points where recording resumed (after a pause or a vehicle stretch). */
  segmentStarts: number[];
};

export type PublicProfile = {
  id: string;
  name: string;
  age: number | null;
  city: string | null;
  bio: string | null;
  skillLevel: string | null;
  job: string | null;
  lookingFor: string | null;
  preferredTime: string | null;
  homeVenue: string | null;
  photos: string[];
  sports: { sportId: string; experienceLevel: string | null }[];
  prompts: { question: { en: string; id: string }; answer: string }[];
  activities: Activity[];
};

export const activitiesApi = {
  create: (a: NewActivity) => api<Activity>('/v1/activities', { body: a }),
  mine: (opts: { onProfile?: boolean; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.onProfile) q.set('onProfile', 'true');
    if (opts.limit) q.set('limit', String(opts.limit));
    const qs = q.toString();
    return api<Activity[]>(`/v1/activities${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api<Activity>(`/v1/activities/${id}`),
  update: (id: string, patch: { title?: string; showOnProfile?: boolean; isPublic?: boolean }) =>
    api<Activity>(`/v1/activities/${id}`, { method: 'PATCH', body: patch }),
  remove: (id: string) => api(`/v1/activities/${id}`, { method: 'DELETE' }),
};

export const usersApi = {
  get: (id: string) => api<PublicProfile>(`/v1/users/${id}`),
  activities: (id: string) => api<Activity[]>(`/v1/users/${id}/activities`),
};

// ── Explore: open sessions, SOS, events (server/src/modules/explore) ─────────────

export type PostCreator = { id: string; name: string; photoUrl: string | null };

export type OpenSession = {
  id: string;
  sport: string;
  title: string;
  venueName: string;
  scheduledAt: string;
  slotsTotal: number;
  slotsFilled: number;
  genderPref: GenderPreference;
  skillNote: string | null;
  status: 'OPEN' | 'FULL';
  creator: PostCreator;
  isJoined: boolean;
  isMine: boolean;
};

export type SosPost = {
  id: string;
  sport: string;
  venueName: string;
  playTime: string;
  slotsNeeded: number;
  slotsLeft: number;
  feePerPerson: number;
  note: string | null;
  creator: PostCreator;
  claimedByMe: boolean;
  isMine: boolean;
};

export type SportEvent = {
  id: string;
  title: string;
  organizer: string;
  type: string;
  category: string;
  startsAt: string;
  location: string;
  city: string;
  /** Rupiah; 0 = free. */
  priceIdr: number;
  quota: number | null;
  imageUrl: string | null;
  isFeatured: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  registrations: number;
  isMine: boolean;
  isRegistered: boolean;
};

export const sessionsApi = {
  list: (sport?: string) => api<OpenSession[]>(`/v1/sessions${sport ? `?sport=${encodeURIComponent(sport)}` : ''}`),
  create: (body: {
    sport: string;
    title: string;
    venueName: string;
    scheduledAt: string;
    slotsTotal: number;
    genderPref: GenderPreference;
    skillNote?: string | null;
  }) => api<{ id: string }>('/v1/sessions', { body }),
  join: (id: string) => api(`/v1/sessions/${id}/join`, { method: 'POST' }),
  leave: (id: string) => api(`/v1/sessions/${id}/join`, { method: 'DELETE' }),
  cancel: (id: string) => api(`/v1/sessions/${id}`, { method: 'DELETE' }),
};

export const sosApi = {
  list: () => api<SosPost[]>('/v1/sos'),
  create: (body: {
    sport: string;
    venueName: string;
    slotsNeeded: number;
    feePerPerson: number;
    contactWa: string;
    note?: string | null;
  }) => api<{ id: string }>('/v1/sos', { body }),
  /** The answer carries the host's WhatsApp number, given only to people who took a spot. */
  claim: (id: string) => api<{ contactWa: string }>(`/v1/sos/${id}/claim`, { method: 'POST' }),
  cancel: (id: string) => api(`/v1/sos/${id}`, { method: 'DELETE' }),
};

export const eventsApi = {
  list: () => api<SportEvent[]>('/v1/events'),
  get: (id: string) => api<SportEvent>(`/v1/events/${id}`),
  create: (body: {
    title: string;
    organizer: string;
    type: string;
    category: string;
    startsAt: string;
    location: string;
    city: string;
    priceIdr: number;
    quota?: number | null;
    imageUrl?: string | null;
  }) => api<SportEvent>('/v1/events', { body }),
  register: (id: string) => api<SportEvent>(`/v1/events/${id}/register`, { method: 'POST' }),
  unregister: (id: string) => api<SportEvent>(`/v1/events/${id}/register`, { method: 'DELETE' }),
};
