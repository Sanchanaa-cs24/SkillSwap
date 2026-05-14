import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import { api, getApiBase, getAuthToken, setAuthToken } from './src/api';
import type {
  AdminDashboard,
  AdminReport,
  AppNotification,
  AuthResponse,
  CommunityEvent,
  DiscoveryCard,
  LearningPlan,
  MessageThread,
  Messages,
  PortfolioAsset,
  RoomDiscussionMessage,
  Session,
  Tab,
  User,
} from './src/types';

const tabs: Tab[] = ['Discover', 'Sessions', 'Community', 'Progress', 'Profile'];
const personas = ['All', 'teacher', 'learner'] as const;
const TOKEN_KEY = 'skillsswap_token';

const local = (globalThis as { localStorage?: Storage }).localStorage;
const readStoredToken = () => local?.getItem(TOKEN_KEY) ?? '';
const storeToken = (token: string) => local?.setItem(TOKEN_KEY, token);
const clearToken = () => local?.removeItem(TOKEN_KEY);
const isWeb = Platform.OS === 'web';
const runtimeOrigin =
  typeof window !== 'undefined' && window?.location?.origin
    ? window.location.origin
    : '';
const resolvedApiBase = getApiBase();
const calendarBaseUrl =
  isWeb
    ? runtimeOrigin || resolvedApiBase.replace(/\/api$/, '')
    : resolvedApiBase.replace(/\/api$/, '');
const displayFont = Platform.select({
  web: '"Avenir Next", "SF Pro Display", system-ui, sans-serif',
  ios: 'Avenir Next',
  default: 'sans-serif',
});
const textFont = Platform.select({
  web: '"Inter", "Avenir Next", system-ui, sans-serif',
  ios: 'Avenir Next',
  default: 'sans-serif',
});
const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
const keyboardOffset = Platform.OS === 'ios' ? 18 : 0;
const triggerNativeTap = () => {
  if (!isWeb) {
    Vibration.vibrate(8);
  }
};

const completeProfile = (user: User | null) =>
  Boolean(
    user &&
      user.headline &&
      user.bio &&
      user.country &&
      (user.skillsOffered ?? []).length &&
      (user.skillsToLearn ?? []).length &&
      (user.helpOffered ?? []).length &&
      (user.helpWanted ?? []).length
  );

const pageMeta: Record<Tab, { label: string; eyebrow: string }> = {
  Discover: { label: 'Home', eyebrow: 'DISCOVERY FEED' },
  Sessions: { label: 'Bookings', eyebrow: 'MANAGE SESSIONS' },
  Community: { label: 'Rooms', eyebrow: 'EVENTS & CONVERSATIONS' },
  Progress: { label: 'Progress', eyebrow: 'MOMENTUM & GOALS' },
  Profile: { label: 'Profile', eyebrow: 'MEMBER IDENTITY' },
};

const mobileTabLabel: Record<Tab, string> = {
  Discover: 'Home',
  Sessions: 'Bookings',
  Community: 'Rooms',
  Progress: 'Progress',
  Profile: 'Profile',
};

type ProfilePath = 'mentor' | 'learner' | 'both';

const onboardingSkillOptions = [
  'Design Systems',
  'UX Research',
  'Mobile UI',
  'Advanced System Design',
  'React Native Performance',
  'Growth Marketing',
  'Business English',
  'Go-To-Market Strategy',
  'Pitch Narratives',
  'Retention Strategy',
  'Story-led Marketing',
  'Interview Communication',
];

const onboardingInterestOptions = [
  'Mentorship',
  'Peer exchange',
  'Portfolio review',
  'Career growth',
  'Interview prep',
  'Product strategy',
  'Community rooms',
  'Live practice',
];

const extraSeedSessions: Session[] = [
  {
    id: 'local-session-1',
    cardId: 'card-9',
    with: 'Priya Nair',
    skill: 'UX Strategy',
    time: 'Fri 11:00',
    status: 'upcoming',
    createdAt: '2026-05-10T08:00:00.000Z',
    calendarUrl: '',
  },
  {
    id: 'local-session-2',
    cardId: 'card-16',
    with: 'Omar Hassan',
    skill: 'React Native Performance',
    time: 'Sat 11:30',
    status: 'upcoming',
    createdAt: '2026-05-11T09:00:00.000Z',
    calendarUrl: '',
  },
  {
    id: 'local-session-3',
    cardId: 'card-15',
    with: 'Maya Chen',
    skill: 'Retention Strategy',
    time: 'Sun 09:30',
    status: 'completed',
    createdAt: '2026-05-08T09:00:00.000Z',
    calendarUrl: '',
  },
];

const extraSeedEvents: CommunityEvent[] = [
  {
    id: 'local-event-1',
    title: 'Design Crit Night',
    description: 'Review premium mobile flows with mentors and peers in a live critique room.',
    participants: 96,
    joined: false,
    format: 'Live room',
    host: 'Lucia Romano',
    location: 'Remote',
    category: 'Design',
  },
  {
    id: 'local-event-2',
    title: 'React Native Ship Room',
    description: 'A focused build room for performance fixes, release prep, and app polish.',
    participants: 143,
    joined: false,
    format: 'Build sprint',
    host: 'Omar Hassan',
    location: 'Remote',
    category: 'Development',
  },
  {
    id: 'local-event-3',
    title: 'Growth Copy Lab',
    description: 'Tighten onboarding, retention, and activation messaging with structured feedback.',
    participants: 81,
    joined: false,
    format: 'Workshop',
    host: 'Maya Chen',
    location: 'Remote',
    category: 'Marketing',
  },
  {
    id: 'local-event-4',
    title: 'Founder Story Circle',
    description: 'Practice founder narratives, product positioning, and investor updates in small groups.',
    participants: 67,
    joined: false,
    format: 'Small group',
    host: 'Ethan Brooks',
    location: 'Remote',
    category: 'Business',
  },
];

type DiscoverMode = 'mentor' | 'learner' | 'balanced';

type MemberInsight = {
  responseTime: string;
  proof: string;
  sessionGoal: string;
  testimonial: string;
  trustBadges: string[];
  completedSessions: number;
  repeatLearners: number;
  endorsement: string;
};

type BookingSetup = {
  format: 'Video call' | 'Audio call' | 'Async review';
  goal: string;
  note: string;
  slot: string;
};

const memberInsights: Record<string, MemberInsight> = {
  'card-1': {
    responseTime: '~2h reply time',
    proof: '42 sessions completed',
    sessionGoal: 'Leave with a cleaner UI system plan and reusable structure.',
    testimonial: 'Clear, high-signal feedback that immediately improved our interface decisions.',
    trustBadges: ['Top mentor', 'System thinker', 'Fast replies'],
    completedSessions: 42,
    repeatLearners: 17,
    endorsement: 'Known for making interface systems feel lighter, clearer, and more reusable.',
  },
  'card-2': {
    responseTime: 'Same-day replies',
    proof: '31 architecture reviews',
    sessionGoal: 'Turn vague backend concerns into a concrete scaling roadmap.',
    testimonial: 'He made complex system tradeoffs feel simple and actionable.',
    trustBadges: ['Architecture lead', 'Practical advice', 'Deep technical'],
    completedSessions: 31,
    repeatLearners: 12,
    endorsement: 'Strong with backend tradeoffs, system design, and practical production decisions.',
  },
  'card-5': {
    responseTime: '~4h reply time',
    proof: '58 coaching calls',
    sessionGoal: 'Practice clearer business communication with live feedback.',
    testimonial: 'Every session feels focused, warm, and immediately useful.',
    trustBadges: ['Interview coach', 'Communication expert', 'Highly rated'],
    completedSessions: 58,
    repeatLearners: 21,
    endorsement: 'Frequently booked for interview prep, communication clarity, and confidence building.',
  },
  'card-9': {
    responseTime: '~3h reply time',
    proof: '27 product strategy sessions',
    sessionGoal: 'Sharpen product direction and improve conversion-critical UX decisions.',
    testimonial: 'Her strategy feedback helped us simplify the whole product story.',
    trustBadges: ['Product strategy', 'UX clarity', 'Founder-friendly'],
    completedSessions: 27,
    repeatLearners: 10,
    endorsement: 'Trusted for product direction, positioning, and conversion-focused design decisions.',
  },
  'card-15': {
    responseTime: '~5h reply time',
    proof: '19 retention workshops',
    sessionGoal: 'Identify the retention loop that matters most and build around it.',
    testimonial: 'The advice was concrete, measurable, and directly tied to growth outcomes.',
    trustBadges: ['Growth advisor', 'Retention expert', 'Metrics-driven'],
    completedSessions: 19,
    repeatLearners: 7,
    endorsement: 'Best used when the goal is to improve retention, activation, or growth loops.',
  },
  'card-16': {
    responseTime: 'Fast replies',
    proof: '36 mobile performance sessions',
    sessionGoal: 'Pinpoint where the app feels heavy and map the next performance fixes.',
    testimonial: 'Extremely practical guidance for making mobile apps feel production-ready.',
    trustBadges: ['Mobile lead', 'Performance expert', 'Ship-focused'],
    completedSessions: 36,
    repeatLearners: 14,
    endorsement: 'Strong fit for mobile apps that need polish, speed, and execution clarity.',
  },
  'card-17': {
    responseTime: '~6h reply time',
    proof: 'Design exchange regular',
    sessionGoal: 'Trade premium mobile UI critique and visual direction references.',
    testimonial: 'Thoughtful visual feedback and a very strong design eye.',
    trustBadges: ['Visual craft', 'Premium taste', 'Peer exchange'],
    completedSessions: 14,
    repeatLearners: 6,
    endorsement: 'Great for peer review, mobile craft critique, and premium visual refinement.',
  },
};

type AppRoute =
  | { kind: 'member'; card: DiscoveryCard }
  | { kind: 'session'; session: Session }
  | { kind: 'event'; event: CommunityEvent }
  | { kind: 'progress' }
  | { kind: 'inbox' }
  | { kind: 'thread'; thread: MessageThread }
  | { kind: 'booking'; card: DiscoveryCard }
  | { kind: 'booking-confirmed'; session: Session; setup: BookingSetup };

const iconForTab = (tab: Tab) => {
  if (tab === 'Discover') return 'Home';
  if (tab === 'Sessions') return 'Calendar';
  if (tab === 'Community') return 'Circle';
  if (tab === 'Progress') return 'Growth';
  return 'Profile';
};

const personaLabel = (value: (typeof personas)[number]) => {
  if (value === 'teacher') return 'Mentors';
  if (value === 'learner') return 'Explorers';
  return 'Everyone';
};

const bookingFormats: BookingSetup['format'][] = ['Video call', 'Audio call', 'Async review'];

const modeExperienceCopy: Record<
  DiscoverMode,
  { heading: string; body: string; bullets: string[] }
> = {
  mentor: {
    heading: 'Learning mode is active',
    body: 'The feed leans toward teachers and operators who can unblock your next skill jump quickly.',
    bullets: ['Prioritizes mentors with your target skills', 'Highlights faster reply quality', 'Keeps bookable profiles near the top'],
  },
  learner: {
    heading: 'Teaching mode is active',
    body: 'The feed now favors people who want what you already know, so exchange value is easier to spot.',
    bullets: ['Surfaces learners aligned with your strengths', 'Makes contribution opportunities clearer', 'Supports stronger peer-to-peer loops'],
  },
  balanced: {
    heading: 'Exchange mode is active',
    body: 'The app is balancing mentors, learners, and peers so discovery feels more like a two-sided network.',
    bullets: ['Blends mentorship and peer exchange', 'Optimizes for fit instead of one persona only', 'Keeps the network feeling alive and reciprocal'],
  },
};

export default function App() {
  const { width } = useWindowDimensions();
  const isPhone = width < 640 || isWeb;
  const isWide = width >= 1180 && !isPhone;
  const isTablet = width >= 900 && !isPhone;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentLift = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(1)).current;

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Discover');
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('demo@skillsswap.app');
  const [authPassword, setAuthPassword] = useState('demo123');

  const [profileName, setProfileName] = useState('');
  const [profileHeadline, setProfileHeadline] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileCountry, setProfileCountry] = useState('');
  const [profileOfferedSkills, setProfileOfferedSkills] = useState<string[]>([]);
  const [profileLearnSkills, setProfileLearnSkills] = useState<string[]>([]);
  const [profileHelpOffered, setProfileHelpOffered] = useState<string[]>([]);
  const [profileHelpWanted, setProfileHelpWanted] = useState<string[]>([]);
  const [profilePath, setProfilePath] = useState<ProfilePath>('both');
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [profileModal, setProfileModal] = useState(false);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [persona, setPersona] = useState<(typeof personas)[number]>('All');
  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>('mentor');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [cards, setCards] = useState<DiscoveryCard[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [extraSessions, setExtraSessions] = useState(extraSeedSessions);
  const [extraEvents, setExtraEvents] = useState(extraSeedEvents);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [messages, setMessages] = useState<Messages>({ unreadCount: 0 });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboard | null>(null);
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>([]);
  const [assetTitle, setAssetTitle] = useState('');
  const [assetUrl, setAssetUrl] = useState('');
  const [assetKind, setAssetKind] = useState<PortfolioAsset['kind']>('link');
  const [roomDiscussionByEvent, setRoomDiscussionByEvent] = useState<
    Record<string, RoomDiscussionMessage[]>
  >({});
  const [roomDrafts, setRoomDrafts] = useState<Record<string, string>>({});
  const [adminRecapDrafts, setAdminRecapDrafts] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [navStack, setNavStack] = useState<AppRoute[]>([]);
  const [slot, setSlot] = useState('');
  const [bookingFormat, setBookingFormat] = useState<BookingSetup['format']>('Video call');
  const [bookingGoal, setBookingGoal] = useState('');
  const [bookingNote, setBookingNote] = useState('');

  const displaySessions = useMemo(
    () => [...sessions, ...extraSessions],
    [extraSessions, sessions]
  );
  const displayEvents = useMemo(
    () => [...events, ...extraEvents],
    [events, extraEvents]
  );
  const currentRoute = navStack[navStack.length - 1] ?? null;
  const showingDetailPage = navStack.length > 0;

  const completedCount = useMemo(
    () =>
      plan
        ? [plan.profileCompleted, plan.firstSessionBooked, plan.challengeJoined].filter(Boolean)
            .length
        : 0,
    [plan]
  );

  const mentorCount = useMemo(
    () => cards.filter((card) => card.persona === 'teacher').length,
    [cards]
  );
  const learnerCount = useMemo(
    () => cards.filter((card) => card.persona === 'learner').length,
    [cards]
  );
  const upcomingSessions = useMemo(
    () => displaySessions.filter((session) => session.status === 'upcoming'),
    [displaySessions]
  );
  const liveSessions = useMemo(
    () => displaySessions.filter((session) => session.status === 'live'),
    [displaySessions]
  );
  const completedSessions = useMemo(
    () => displaySessions.filter((session) => session.status === 'completed'),
    [displaySessions]
  );
  const savedCards = useMemo(
    () => cards.filter((card) => card.favorited),
    [cards]
  );
  const connectedCards = useMemo(
    () => cards.filter((card) => card.connected),
    [cards]
  );

  const rankedCards = useMemo(() => {
    const learn = new Set((user?.skillsToLearn ?? []).map((item) => item.toLowerCase()));
    const offer = new Set((user?.skillsOffered ?? []).map((item) => item.toLowerCase()));

    const scoreCard = (card: DiscoveryCard) => {
      let score = card.rating * 10;
      const skill = card.skill.toLowerCase();
      const title = card.title.toLowerCase();
      const bio = card.bio.toLowerCase();

      if (learn.has(skill)) score += 40;
      if (offer.has(skill)) score += 34;
      if ([...learn].some((item) => title.includes(item) || bio.includes(item))) score += 18;
      if ([...offer].some((item) => title.includes(item) || bio.includes(item))) score += 14;
      if (card.nextSessionSlots.some((slotValue) => slotValue.toLowerCase().includes('today'))) score += 8;
      if (card.connected) score += 5;
      if (card.favorited) score += 4;

      if (discoverMode === 'mentor' && card.persona === 'teacher') score += 22;
      if (discoverMode === 'learner' && card.persona === 'learner') score += 22;
      if (discoverMode === 'balanced') score += card.persona === 'teacher' ? 10 : 9;

      return score;
    };

    return [...cards].sort((left, right) => scoreCard(right) - scoreCard(left));
  }, [cards, discoverMode, user]);

  const mentorMatches = useMemo(
    () => rankedCards.filter((card) => card.persona === 'teacher'),
    [rankedCards]
  );
  const learnerMatches = useMemo(
    () => rankedCards.filter((card) => card.persona === 'learner'),
    [rankedCards]
  );
  const primaryDiscoverCards = useMemo(() => {
    if (discoverMode === 'mentor') return mentorMatches;
    if (discoverMode === 'learner') return learnerMatches;
    return rankedCards;
  }, [discoverMode, learnerMatches, mentorMatches, rankedCards]);

  const secondaryDiscoverCards = useMemo(() => {
    if (discoverMode === 'mentor') return learnerMatches.slice(0, 4);
    if (discoverMode === 'learner') return mentorMatches.slice(0, 4);
    return [];
  }, [discoverMode, learnerMatches, mentorMatches]);
  const recommendedCards = useMemo(
    () => rankedCards.slice(0, isWide ? 6 : isPhone ? 3 : 4),
    [isPhone, isWide, rankedCards]
  );
  const phoneRecommendedCards = useMemo(
    () => primaryDiscoverCards.slice(0, 15),
    [primaryDiscoverCards]
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );
  const humanThreads = useMemo(
    () => threads.filter((item) => item.category !== 'system'),
    [threads]
  );
  const bookingThreads = useMemo(
    () => threads.filter((item) => item.category === 'booking'),
    [threads]
  );
  const systemNotifications = useMemo(
    () => notifications.filter((item) => item.kind === 'system' || item.kind === 'community'),
    [notifications]
  );
  const humanNotifications = useMemo(
    () => notifications.filter((item) => item.kind === 'human' || item.kind === 'booking'),
    [notifications]
  );

  useEffect(() => {
    contentOpacity.setValue(0.2);
    contentLift.setValue(18);
    contentScale.setValue(0.985);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(contentLift, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(contentScale, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab, currentRoute, contentLift, contentOpacity, contentScale]);

  const hydrateUser = (next: User) => {
    setUser(next);
    setProfileName(next.name);
    setProfileHeadline(next.headline);
    setProfileBio(next.bio);
    setProfileCountry(next.country);
    setProfileOfferedSkills(next.skillsOffered ?? []);
    setProfileLearnSkills(next.skillsToLearn ?? []);
    setProfileHelpOffered(next.helpOffered ?? next.skillsOffered ?? []);
    setProfileHelpWanted(next.helpWanted ?? next.skillsToLearn ?? []);
    setProfilePath(
      (next.skillsOffered ?? []).length && (next.skillsToLearn ?? []).length
        ? 'both'
        : (next.skillsOffered ?? []).length
          ? 'mentor'
          : 'learner'
    );
    setOnboardingStep(0);
  };

  const resetAppData = () => {
    setCategories(['All']);
    setCards([]);
    setSessions([]);
    setEvents([]);
    setPlan(null);
    setMessages({ unreadCount: 0 });
    setNotifications([]);
    setThreads([]);
    setAdminDashboard(null);
    setPortfolioAssets([]);
    setRoomDiscussionByEvent({});
    setRoomDrafts({});
    setAdminRecapDrafts({});
    setDrafts({});
    setNavStack([]);
    setSlot('');
    setBookingFormat('Video call');
    setBookingGoal('');
    setBookingNote('');
  };

  const loadAll = async () => {
    const [
      nextCategories,
      nextCards,
      nextSessions,
      nextEvents,
      nextPlan,
      nextMessages,
      nextNotifications,
      nextThreads,
      nextAdminDashboard,
      nextPortfolioAssets,
    ] = await Promise.allSettled([
      api.categories(),
      api.discovery(query, category, persona),
      api.sessions(),
      api.events(),
      api.learningPlan(),
      api.messages(),
      api.notifications(),
      api.messageThreads(),
      api.adminDashboard(),
      api.portfolioAssets(),
    ]);

    setCategories([
      'All',
      ...(nextCategories.status === 'fulfilled' ? nextCategories.value : []),
    ]);
    setCards(nextCards.status === 'fulfilled' ? nextCards.value : []);
    setSessions(nextSessions.status === 'fulfilled' ? nextSessions.value : []);
    setEvents(nextEvents.status === 'fulfilled' ? nextEvents.value : []);
    setPlan(nextPlan.status === 'fulfilled' ? nextPlan.value : null);
    setMessages(
      nextMessages.status === 'fulfilled'
        ? nextMessages.value
        : { unreadCount: 0 }
    );
    setNotifications(
      nextNotifications.status === 'fulfilled' ? nextNotifications.value : []
    );
    setThreads(nextThreads.status === 'fulfilled' ? nextThreads.value : []);
    setAdminDashboard(
      nextAdminDashboard.status === 'fulfilled'
        ? nextAdminDashboard.value
        : null
    );
    setPortfolioAssets(
      nextPortfolioAssets.status === 'fulfilled'
        ? nextPortfolioAssets.value
        : []
    );
  };

  const loadEventDiscussion = async (eventId: string) => {
    const messagesForRoom = await api.eventDiscussion(eventId).catch(() => []);
    setRoomDiscussionByEvent((previous) => ({
      ...previous,
      [eventId]: messagesForRoom,
    }));
  };

  useEffect(() => {
    const init = async () => {
      const existing = readStoredToken();
      if (!existing) {
        setAuthToken('');
        resetAppData();
        setBooting(false);
        setLoading(false);
        return;
      }

      setToken(existing);
      setAuthToken(existing);
      try {
        const me = await api.me();
        hydrateUser(me.user);
        await loadAll();
      } catch {
        clearToken();
        setAuthToken('');
        setToken('');
        setUser(null);
        resetAppData();
      } finally {
        setBooting(false);
        setLoading(false);
      }
    };

    void init();
  }, []);

  useEffect(() => {
    if (!token || !user) return;
    void api.discovery(query, category, persona).then(setCards).catch(() => {});
  }, [query, category, persona, token, user]);

  useEffect(() => {
    if (!token || !user) return;
    const timer = setInterval(() => {
      void Promise.all([
        api.messages(),
        api.notifications(),
        api.messageThreads(),
        api.portfolioAssets().catch(() => []),
      ]).then(([nextMessages, nextNotifications, nextThreads, nextPortfolioAssets]) => {
        setMessages(nextMessages);
        setNotifications(nextNotifications);
        setThreads(nextThreads);
        setPortfolioAssets(nextPortfolioAssets);
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [token, user]);

  useEffect(() => {
    if (!token || !user || !isWeb || typeof EventSource === 'undefined') return;
    const stream = new EventSource(`${getApiBase()}/stream?token=${encodeURIComponent(token)}`);
    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; scope?: string };
        if (payload.type === 'refresh') {
          void loadAll();
          if (currentRoute?.kind === 'event') {
            void loadEventDiscussion(currentRoute.event.id);
          }
        }
      } catch {
        // ignore malformed stream payloads
      }
    };
    stream.onerror = () => {
      stream.close();
    };
    return () => stream.close();
  }, [token, user, currentRoute?.kind === 'event' ? currentRoute.event.id : '']);

  useEffect(() => {
    if (currentRoute?.kind === 'event') {
      void loadEventDiscussion(currentRoute.event.id);
      setAdminRecapDrafts((previous) => ({
        ...previous,
        [currentRoute.event.id]: previous[currentRoute.event.id] ?? (currentRoute.event.recap ?? ''),
      }));
    }
  }, [currentRoute?.kind === 'event' ? currentRoute.event.id : '']);

  const onAuth = async () => {
    setError('');
    try {
      setLoading(true);
      let result: AuthResponse;
      if (authMode === 'register') {
        result = await api.register(authName.trim(), authEmail.trim(), authPassword);
      } else {
        result = await api.login(authEmail.trim(), authPassword);
      }
      setAuthToken(result.token);
      storeToken(result.token);
      setToken(result.token);
      hydrateUser(result.user);
      await loadAll();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const openAuthMode = (mode: 'login' | 'register') => {
    setError('');
    setAuthMode(mode);
    setShowAuthForm(true);
  };

  const backToAuthChoice = () => {
    setError('');
    setShowAuthForm(false);
  };

  const onNativeAction = (action: () => void) => () => {
    triggerNativeTap();
    Keyboard.dismiss();
    action();
  };

  const toggleSelection = (
    value: string,
    current: string[],
    setter: (next: string[]) => void,
    limit = 4
  ) => {
    if (current.includes(value)) {
      setter(current.filter((item) => item !== value));
      return;
    }
    if (current.length >= limit) return;
    setter([...current, value]);
  };

  const saveProfile = async () => {
    if (!user) return;
    setError('');
    const offered = profileOfferedSkills.filter(Boolean);
    const learn = profileLearnSkills.filter(Boolean);
    const headlineFallback =
      profilePath === 'mentor'
        ? 'Mentor'
        : profilePath === 'learner'
          ? 'Explorer'
          : 'Builder, mentor, and learner';

    try {
      setLoading(true);
      const updated = await api.saveProfile({
        name: profileName.trim(),
        headline: profileHeadline.trim() || headlineFallback,
        bio: profileBio.trim(),
        country: profileCountry.trim(),
        skillsOffered: offered,
        skillsToLearn: learn,
        helpOffered: profileHelpOffered.length ? profileHelpOffered : offered,
        helpWanted: profileHelpWanted.length ? profileHelpWanted : learn,
        verifiedSkills: offered,
        portfolioProjects:
          user.portfolioProjects?.length
            ? user.portfolioProjects
            : offered.slice(0, 2).map((item) => `${item} practice track`),
      });

      hydrateUser(updated);
      await loadAll();
      setProfileModal(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not finish onboarding');
    } finally {
      setLoading(false);
    }
  };

  const onLogout = () => {
    clearToken();
    setAuthToken('');
    setToken('');
    setUser(null);
    setError('');
    setLoading(false);
    resetAppData();
  };

  const addPortfolioAsset = async () => {
    const title = assetTitle.trim();
    const url = assetUrl.trim();
    if (!title || !url) return;
    const created = await api.addPortfolioAsset({ title, url, kind: assetKind });
    setPortfolioAssets((previous) => [created, ...previous]);
    setAssetTitle('');
    setAssetUrl('');
    setAssetKind('link');
  };

  const removePortfolioAsset = async (assetId: string) => {
    await api.removePortfolioAsset(assetId);
    setPortfolioAssets((previous) => previous.filter((item) => item.id !== assetId));
  };

  const toggleFeaturedMentor = async (card: DiscoveryCard) => {
    const updated = await api.featureMentor(card.id, !card.featured);
    setCards((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    setAdminDashboard((previous) =>
      previous
        ? {
            ...previous,
            featuredMentors: previous.featuredMentors.map((item) =>
              item.id === updated.id ? updated : item
            ),
          }
        : previous
    );
    await loadAll();
  };

  const resolveOperatorReport = async (report: AdminReport) => {
    const dashboard = await api.resolveReport(report.id);
    setAdminDashboard(dashboard);
  };

  const saveEventRecap = async (eventId: string) => {
    const recap = (adminRecapDrafts[eventId] ?? '').trim();
    const updated = await api.updateAdminEvent(eventId, { recap });
    setEvents((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    if (currentRoute?.kind === 'event' && currentRoute.event.id === updated.id) {
      replaceRoute({ kind: 'event', event: updated });
    }
  };

  const updateCard = (id: string, nextCard: DiscoveryCard) => {
    setCards((previous) => previous.map((item) => (item.id === id ? nextCard : item)));
  };

  const getCardById = (cardId: string) => cards.find((item) => item.id === cardId) || null;
  const getCardByName = (name: string) => cards.find((item) => item.name === name) || null;
  const getThreadById = (threadId?: string) =>
    threadId ? threads.find((item) => item.id === threadId) || null : null;
  const getMemberInsight = (card: DiscoveryCard): MemberInsight => {
    return (
      memberInsights[card.id] ?? {
        responseTime: card.persona === 'teacher' ? '~4h reply time' : '~6h reply time',
        proof: card.persona === 'teacher' ? 'Active mentor on SkillSwap' : 'Open to exchange',
        sessionGoal:
          card.persona === 'teacher'
            ? `Use the session to get clear direction on ${card.skill.toLowerCase()}.`
            : `Use the session to exchange strengths around ${card.skill.toLowerCase()}.`,
        testimonial:
          card.persona === 'teacher'
            ? 'Consistently clear, practical guidance with a strong collaborative tone.'
            : 'Brings strong exchange energy and thoughtful follow-through.',
        trustBadges:
          card.persona === 'teacher'
            ? ['Trusted mentor', 'Strong fit', 'Reliable replies']
            : ['Open to exchange', 'Thoughtful peer', 'Good match'],
        completedSessions: card.persona === 'teacher' ? 18 : 11,
        repeatLearners: card.persona === 'teacher' ? 7 : 4,
        endorsement:
          card.persona === 'teacher'
            ? `A reliable guide for making progress in ${card.skill.toLowerCase()}.`
            : `Brings useful exchange energy around ${card.skill.toLowerCase()}.`,
      }
    );
  };
  const activeMemberInsight =
    currentRoute?.kind === 'member' ? getMemberInsight(currentRoute.card) : null;
  const getSessionPlaybook = (session: Session) => {
    const skill = session.skill.toLowerCase();
    if (skill.includes('design')) {
      return {
        formatHint: 'Best run as a screenshare critique with one focused artifact.',
        meetingState:
          session.status === 'live' ? 'Meeting room is open and ready for review.' : 'Meeting link is ready and will unlock at start time.',
        prepChecklist: ['Bring one current screen or workflow', 'List the top 2 friction points', 'Share the outcome you want from the review'],
        resources: ['Latest screen exports', 'A short product context note', 'Links to your current design file'],
        followUp: 'Capture the winning direction, then send one revised screen back in-thread.',
      };
    }
    if (skill.includes('english') || skill.includes('communication')) {
      return {
        formatHint: 'Best run live with speaking prompts and rapid feedback loops.',
        meetingState:
          session.status === 'live' ? 'Call is active and optimized for real-time practice.' : 'Room stays quiet until the scheduled language practice window.',
        prepChecklist: ['Choose one scenario to practice', 'Bring 3 phrases you want to improve', 'Write the confidence gaps you want feedback on'],
        resources: ['Short speaking brief', 'Example phrases or prompts', 'Optional recording plan for review'],
        followUp: 'Summarize corrected phrases and repeat the exercise once more within 24 hours.',
      };
    }

    return {
      formatHint: 'Best run with one concrete problem and a crisp decision target.',
      meetingState:
        session.status === 'live' ? 'Session is active and ready for focused execution.' : 'Meeting link is staged and waiting for the booked time.',
      prepChecklist: ['Write the one decision this session should unlock', 'Add any relevant links or screenshots', 'Bring a before-state so progress is measurable'],
      resources: ['Relevant docs or references', 'Current blockers list', 'One short note on desired outcome'],
      followUp: 'Turn the session into one specific next move and confirm it in the thread.',
    };
  };
  const getEventGuide = (event: CommunityEvent) => {
    const title = event.title.toLowerCase();
    const track = (event.category ?? '').toLowerCase();
    if (title.includes('mentor') || track.includes('career')) {
      return {
        agenda: ['Fast introductions and focus goals', 'Mentor matching sprint', 'One action each before the next check-in'],
        attendees: ['Operators', 'Founders', 'Career switchers', 'Mentors'],
        reminder: 'Best joined with one clear growth goal and one question you want answered live.',
      };
    }
    if (title.includes('mobile') || track.includes('design')) {
      return {
        agenda: ['Bring one mobile screen to review', 'Trade critique in pairs', 'Close with one premium polish commitment'],
        attendees: ['Mobile designers', 'Frontend builders', 'Product designers', 'Peer reviewers'],
        reminder: 'Bring a live screen, a current friction point, and one reference you admire.',
      };
    }

    return {
      agenda: ['Quick room welcome', 'Focused breakout discussion', 'Shared action recap and next steps'],
      attendees: ['Builders', 'Mentors', 'Explorers', 'Community hosts'],
      reminder: 'Join with one concrete topic so the room stays practical and high-signal.',
    };
  };
  const addLocalNotification = (title: string, detail: string) => {
    const entry = {
      id: `local-note-${Date.now()}`,
      title,
      detail,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications((previous) => [entry, ...previous]);
    setMessages((previous) => ({ unreadCount: previous.unreadCount + 1 }));
  };

  const updateSessionStatus = (session: Session, status: Session['status']) => {
    if (session.id.startsWith('local-session-')) {
      setExtraSessions((previous) =>
        previous.map((item) => (item.id === session.id ? { ...item, status } : item))
      );
      return Promise.resolve();
    }

    return api.updateSessionStatus(session.id, status).then((updated) => {
      setSessions((previous) =>
        previous.map((item) => (item.id === session.id ? updated : item))
      );
    });
  };

  const joinEvent = (event: CommunityEvent) => {
    if (event.id.startsWith('local-event-')) {
      setExtraEvents((previous) =>
        previous.map((item) =>
          item.id === event.id
            ? { ...item, joined: true, participants: item.participants + 1 }
            : item
        )
      );
      setPlan((previous) =>
        previous ? { ...previous, challengeJoined: true } : previous
      );
      return Promise.resolve();
    }

    return api.joinEvent(event.id).then((updated) => {
      setEvents((previous) =>
        previous.map((item) => (item.id === event.id ? updated : item))
      );
      setPlan((previous) =>
        previous ? { ...previous, challengeJoined: true } : previous
      );
    });
  };

  const pushRoute = (route: AppRoute) => setNavStack((previous) => [...previous, route]);
  const replaceRoute = (route: AppRoute) =>
    setNavStack((previous) =>
      previous.length ? [...previous.slice(0, -1), route] : [route]
    );
  const popRoute = () => setNavStack((previous) => previous.slice(0, -1));

  const openMemberDetail = (card: DiscoveryCard) => pushRoute({ kind: 'member', card });
  const openSessionDetail = (session: Session) => pushRoute({ kind: 'session', session });
  const openEventDetail = (event: CommunityEvent) => pushRoute({ kind: 'event', event });
  const openProgressDetail = () => pushRoute({ kind: 'progress' });
  const openInbox = () => pushRoute({ kind: 'inbox' });
  const openThread = (thread: MessageThread) => pushRoute({ kind: 'thread', thread });
  const openBookingPage = (card: DiscoveryCard) => {
    const insight = getMemberInsight(card);
    setSlot(card.nextSessionSlots[0] ?? '');
    setBookingFormat('Video call');
    setBookingGoal(insight.sessionGoal);
    setBookingNote('');
    pushRoute({ kind: 'booking', card });
  };
  const closeDetailPage = () => popRoute();

  const renderStatCard = (value: string, label: string, detail: string) => (
    <View style={[styles.statCard, isPhone && styles.statCardPhone]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statDetail}>{detail}</Text>
    </View>
  );

  const renderMemberCard = (card: DiscoveryCard, compact?: boolean) => (
    <View
      key={card.id}
      style={[
        styles.memberCard,
        compact && styles.memberCardCompact,
        isPhone && styles.memberCardPhone,
      ]}
    >
      <View style={[styles.rowBetween, isPhone && styles.rowBetweenPhone]}>
        <View style={styles.memberBadge}>
          <Text style={styles.memberBadgeText}>
            {card.persona === 'teacher' ? 'MENTOR' : 'EXPLORER'}
          </Text>
        </View>
        <Text style={styles.memberRating}>{card.rating.toFixed(1)}</Text>
      </View>
      <Text style={styles.memberName}>{card.name}</Text>
      <Text style={styles.memberMeta}>
        {card.title} · {card.country}
      </Text>
      <View style={styles.trustBadgeRow}>
        {getMemberInsight(card).trustBadges.slice(0, 2).map((badge) => (
          <View key={badge} style={styles.microBadge}>
            <Text style={styles.microBadgeText}>{badge}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.memberSkill}>{card.skill}</Text>
      <Text style={styles.memberBio}>{card.bio}</Text>
      <Text style={styles.memberSignal}>{getMemberInsight(card).proof}</Text>
      <View style={[styles.slotRow, isPhone && styles.slotRowPhone]}>
        {card.nextSessionSlots.slice(0, compact ? 1 : 2).map((nextSlot) => (
          <View key={nextSlot} style={styles.slotChip}>
            <Text style={styles.slotChipText}>{nextSlot}</Text>
          </View>
        ))}
      </View>
      {token && user ? (
        <View style={[styles.actionRow, isPhone && styles.actionRowPhone]}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedScale]}
            onPress={() => api.toggleConnect(card.id).then((updated) => updateCard(card.id, updated))}
          >
            <Text style={styles.primaryButtonText}>
              {card.connected ? 'Connected' : 'Connect'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => api.toggleFavorite(card.id).then((updated) => updateCard(card.id, updated))}
          >
            <Text style={styles.softButtonText}>
              {card.favorited ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
            onPress={() => {
              openBookingPage(card);
            }}
          >
            <Text style={styles.ghostButtonText}>Book</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const renderMobileMemberCard = (card: DiscoveryCard) => (
    <View key={card.id} style={styles.mobileMemberCard}>
      <View style={styles.rowBetween}>
        <View style={styles.memberBadge}>
          <Text style={styles.memberBadgeText}>
            {card.persona === 'teacher' ? 'MENTOR' : 'EXPLORER'}
          </Text>
        </View>
        <Text style={styles.memberRating}>{card.rating.toFixed(1)}</Text>
      </View>
      <Text style={styles.memberName}>{card.name}</Text>
      <Text style={styles.memberMeta}>
        {card.title} · {card.country}
      </Text>
      <View style={styles.trustBadgeRow}>
        {getMemberInsight(card).trustBadges.slice(0, 2).map((badge) => (
          <View key={badge} style={styles.microBadge}>
            <Text style={styles.microBadgeText}>{badge}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.memberSkill}>{card.skill}</Text>
      <Text style={styles.memberBio}>{card.bio}</Text>
      <Text style={styles.memberSignal}>{getMemberInsight(card).proof}</Text>
      <View style={styles.mobileSlotRow}>
        {card.nextSessionSlots.slice(0, 2).map((nextSlot) => (
          <View key={nextSlot} style={styles.mobileSlotChip}>
            <Text style={styles.slotChipText}>{nextSlot}</Text>
          </View>
        ))}
      </View>
      {token && user ? (
        <View style={styles.mobileActionRow}>
          <Pressable
            style={({ pressed }) => [styles.mobileOutlineButton, pressed && styles.pressedScale]}
            onPress={() => openMemberDetail(card)}
          >
            <Text style={styles.ghostButtonText}>View brief</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.mobilePrimaryButton, pressed && styles.pressedScale]}
            onPress={() => api.toggleConnect(card.id).then((updated) => updateCard(card.id, updated))}
          >
            <Text style={styles.primaryButtonText}>
              {card.connected ? 'Connected' : 'Connect'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.mobileSecondaryButton, pressed && styles.pressedScale]}
            onPress={() => api.toggleFavorite(card.id).then((updated) => updateCard(card.id, updated))}
          >
            <Text style={styles.softButtonText}>
              {card.favorited ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.mobileOutlineButton, pressed && styles.pressedScale]}
            onPress={() => {
              openBookingPage(card);
            }}
          >
            <Text style={styles.ghostButtonText}>Book</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const renderLanding = () => (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.authStartPage}>
        <LinearGradient
          colors={['#f7f4f1', '#ece5dd', '#f7f4f1']}
          style={styles.authBackground}
        />
        <KeyboardAvoidingView
          style={styles.authPanelWrapper}
          behavior={keyboardBehavior}
          keyboardVerticalOffset={keyboardOffset}
        >
          <View style={[styles.authPanel, isPhone && styles.authPanelPhone]}>
            <View style={styles.authPanelHeader}>
              <Text style={styles.authPanelLabel}>SKILLSWAP</Text>
              <Text style={styles.authPanelHeadline}>Join our community of learners and teachers</Text>
              <Text style={styles.authPanelSubhead}>
                A cleaner, more polished sign in experience built for mobile and web.
              </Text>
            </View>
            <View style={styles.authCard}>
              <Text style={styles.authCardTitle}>{authMode === 'register' ? 'Create account' : 'Welcome back'}</Text>
              <Text style={styles.authCardText}>
                {authMode === 'register'
                  ? 'Register to start trading skills, booking sessions, and joining community rooms.'
                  : 'Login to continue your learning journey and access your profile.'}
              </Text>
              <View style={styles.authFormWrap}>
                {authMode === 'register' ? (
                  <TextInput
                    style={styles.authInput}
                    value={authName}
                    onChangeText={setAuthName}
                    placeholder="Full name"
                    placeholderTextColor="#9a9aa8"
                    returnKeyType="next"
                  />
                ) : null}
                <TextInput
                  style={styles.authInput}
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  placeholder="Email Address"
                  placeholderTextColor="#9a9aa8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
                <TextInput
                  style={styles.authInput}
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder="Password"
                  placeholderTextColor="#9a9aa8"
                  secureTextEntry
                  returnKeyType="done"
                />
                <Pressable
                  style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
                  onPress={onNativeAction(() => {
                    void onAuth();
                  })}
                >
                  <Text style={styles.primaryWideButtonText}>
                    {authMode === 'register' ? 'Sign up' : 'Log in'}
                  </Text>
                </Pressable>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            </View>
            <View style={styles.authChoiceFooter}>
              <Text style={styles.authChoiceText}>
                {authMode === 'register'
                  ? 'Already have an account?'
                  : 'New to SkillsSwap?'}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
                onPress={onNativeAction(() => openAuthMode(authMode === 'register' ? 'login' : 'register'))}
              >
                <Text style={styles.ghostButtonText}>
                  {authMode === 'register' ? 'Log in' : 'Create account'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );

  const renderOnboardingFlow = (embedded?: boolean) => {
    const stepReady =
      onboardingStep === 0
        ? Boolean(profileName.trim() && profileCountry.trim())
        : onboardingStep === 1
          ? Boolean(profileOfferedSkills.length && profileLearnSkills.length)
          : Boolean(profileHelpOffered.length && profileHelpWanted.length && profileBio.trim());

    return (
      <View style={styles.pageStack}>
        <LinearGradient colors={['#0d1c17', '#17392e']} style={styles.completionHero}>
          <Text style={styles.eyebrow}>ONBOARDING</Text>
          <Text style={styles.completionTitle}>
            Build your SkillsSwap identity before you enter the network.
          </Text>
          <Text style={styles.completionBody}>
            We only need a few signals: who you are, what you can offer, what you want to learn, and the kinds of exchanges you want.
          </Text>
        </LinearGradient>

        <View style={styles.onboardingStepRow}>
          {['Basics', 'Skills', 'Interests'].map((label, index) => (
            <View
              key={label}
              style={[
                styles.onboardingStepPill,
                onboardingStep === index && styles.onboardingStepPillActive,
              ]}
            >
              <Text
                style={[
                  styles.onboardingStepText,
                  onboardingStep === index && styles.onboardingStepTextActive,
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>

        {onboardingStep === 0 ? (
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Your name"
              placeholderTextColor="#7a8a84"
            />
            <TextInput
              style={styles.input}
              value={profileCountry}
              onChangeText={setProfileCountry}
              placeholder="Country"
              placeholderTextColor="#7a8a84"
            />
            <TextInput
              style={styles.input}
              value={profileHeadline}
              onChangeText={setProfileHeadline}
              placeholder="Short headline, for example Product Designer"
              placeholderTextColor="#7a8a84"
            />
            <Text style={styles.infoLabel}>How do you want to use SkillsSwap?</Text>
            <View style={styles.onboardingChoiceGrid}>
              {([
                ['mentor', 'I want to teach'],
                ['learner', 'I want to learn'],
                ['both', 'I want both'],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  style={({ pressed }) => [
                    styles.onboardingChoiceCard,
                    profilePath === value && styles.onboardingChoiceCardActive,
                    pressed && styles.pressedScale,
                  ]}
                  onPress={onNativeAction(() => setProfilePath(value))}
                >
                  <Text
                    style={[
                      styles.onboardingChoiceTitle,
                      profilePath === value && styles.onboardingChoiceTitleActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {onboardingStep === 1 ? (
          <View style={styles.formCard}>
            <Text style={styles.surfaceTitle}>Choose the skills you offer</Text>
            <Text style={styles.surfaceHint}>Pick up to 4 so matching stays focused.</Text>
            <View style={styles.tagWrap}>
              {onboardingSkillOptions.map((item) => (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.tag,
                    profileOfferedSkills.includes(item) && styles.filterChipActive,
                    pressed && styles.pressedScale,
                  ]}
                  onPress={onNativeAction(() =>
                    toggleSelection(item, profileOfferedSkills, setProfileOfferedSkills)
                  )}
                >
                  <Text
                    style={[
                      styles.tagText,
                      profileOfferedSkills.includes(item) && styles.filterChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.surfaceTitle}>Choose the skills you want to learn</Text>
            <Text style={styles.surfaceHint}>Pick up to 4 so the app can rank better matches.</Text>
            <View style={styles.tagWrap}>
              {onboardingSkillOptions.map((item) => (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.tag,
                    profileLearnSkills.includes(item) && styles.filterChipActive,
                    pressed && styles.pressedScale,
                  ]}
                  onPress={onNativeAction(() =>
                    toggleSelection(item, profileLearnSkills, setProfileLearnSkills)
                  )}
                >
                  <Text
                    style={[
                      styles.tagText,
                      profileLearnSkills.includes(item) && styles.filterChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {onboardingStep === 2 ? (
          <View style={styles.formCard}>
            <Text style={styles.surfaceTitle}>What kinds of exchanges do you want?</Text>
            <Text style={styles.infoLabel}>I can help with</Text>
            <View style={styles.tagWrap}>
              {onboardingInterestOptions.map((item) => (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.tag,
                    profileHelpOffered.includes(item) && styles.filterChipActive,
                    pressed && styles.pressedScale,
                  ]}
                  onPress={onNativeAction(() =>
                    toggleSelection(item, profileHelpOffered, setProfileHelpOffered)
                  )}
                >
                  <Text
                    style={[
                      styles.tagText,
                      profileHelpOffered.includes(item) && styles.filterChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.infoLabel}>I want help with</Text>
            <View style={styles.tagWrap}>
              {onboardingInterestOptions.map((item) => (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.tag,
                    profileHelpWanted.includes(item) && styles.filterChipActive,
                    pressed && styles.pressedScale,
                  ]}
                  onPress={onNativeAction(() =>
                    toggleSelection(item, profileHelpWanted, setProfileHelpWanted)
                  )}
                >
                  <Text
                    style={[
                      styles.tagText,
                      profileHelpWanted.includes(item) && styles.filterChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={profileBio}
              onChangeText={setProfileBio}
              placeholder="Write a short intro about how you work and the kind of people you want to meet."
              placeholderTextColor="#7a8a84"
              multiline
            />
          </View>
        ) : null}

        <View style={styles.actionRowPhone}>
          {onboardingStep > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
              onPress={onNativeAction(() => setOnboardingStep((current) => Math.max(0, current - 1)))}
            >
              <Text style={styles.softButtonText}>Back</Text>
            </Pressable>
          ) : null}
          {onboardingStep < 2 ? (
            <Pressable
              style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale, !stepReady && styles.buttonDisabled]}
              onPress={stepReady ? onNativeAction(() => setOnboardingStep((current) => current + 1)) : undefined}
            >
              <Text style={styles.primaryWideButtonText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale, (!stepReady || loading) && styles.buttonDisabled]}
              onPress={
                stepReady && !loading
                  ? onNativeAction(() => {
                      void saveProfile();
                    })
                  : undefined
              }
            >
              <Text style={styles.primaryWideButtonText}>
                {loading ? 'Saving...' : embedded ? 'Save onboarding' : 'Enter app'}
              </Text>
            </Pressable>
          )}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  };

  const renderProfileCompletion = () => (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={keyboardOffset}
      >
      <ScrollView contentContainerStyle={styles.landingScroll} keyboardShouldPersistTaps="always">
        {renderOnboardingFlow()}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  const renderQuickActions = () => (
    <View style={[styles.quickActionRow, isPhone && styles.quickActionRowPhone]}>
      <Pressable
        style={({ pressed }) => [
          styles.quickAction,
          isPhone && styles.quickActionPhone,
          pressed && styles.pressedScale,
        ]}
        onPress={() => setActiveTab('Sessions')}
      >
        <Text style={styles.quickActionLabel}>Next session</Text>
        <Text style={styles.quickActionValue}>
          {upcomingSessions[0]?.time ?? 'Book one now'}
        </Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.quickAction,
          isPhone && styles.quickActionPhone,
          pressed && styles.pressedScale,
        ]}
        onPress={() => setActiveTab('Community')}
      >
        <Text style={styles.quickActionLabel}>Unread conversations</Text>
        <Text style={styles.quickActionValue}>{messages.unreadCount} active</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.quickAction,
          isPhone && styles.quickActionPhone,
          pressed && styles.pressedScale,
        ]}
        onPress={() => setActiveTab('Progress')}
      >
        <Text style={styles.quickActionLabel}>Progress</Text>
        <Text style={styles.quickActionValue}>{completedCount}/3 milestones</Text>
      </Pressable>
    </View>
  );

  const renderPhoneSectionTitle = (title: string, hint?: string) => (
    <View style={styles.surfaceHeader}>
      <Text style={styles.surfaceTitle}>{title}</Text>
      {hint ? <Text style={styles.surfaceHint}>{hint}</Text> : null}
    </View>
  );

  const discoverModeCopy: Record<DiscoverMode, { title: string; hint: string }> = {
    mentor: {
      title: 'Mentors for your next jump',
      hint: 'Ranked around what you want to learn right now',
    },
    learner: {
      title: 'Peers who want what you offer',
      hint: 'People you can help while building stronger exchange loops',
    },
    balanced: {
      title: 'Best exchange opportunities',
      hint: 'A blended feed of mentors and learners with strong fit signals',
    },
  };

  const renderDashboard = () => (
    isPhone ? (
      <View style={styles.pageStack}>
        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Discover people', 'Search, filter, and book from one place')}
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search mentors, explorers, or skills"
            placeholderTextColor="#7a8a84"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {(['mentor', 'learner', 'balanced'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  style={({ pressed }) => [
                    styles.modeFilterChip,
                    discoverMode === mode && styles.modeFilterChipActive,
                    pressed && styles.pressedScale,
                  ]}
                  onPress={() => setDiscoverMode(mode)}
                >
                  <Text
                    style={[
                      styles.modeFilterChipText,
                      discoverMode === mode && styles.modeFilterChipTextActive,
                    ]}
                  >
                    {mode === 'mentor'
                      ? 'Find mentors'
                      : mode === 'learner'
                        ? 'Find learners'
                        : 'Balanced'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {categories.map((item) => (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.filterChip,
                    category === item && styles.filterChipActive,
                    pressed && styles.pressedScale,
                  ]}
                  onPress={() => setCategory(item)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      category === item && styles.filterChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.phoneListHeader}>
          <Text style={styles.phoneListTitle}>{discoverModeCopy[discoverMode].title}</Text>
          <Text style={styles.phoneListHint}>
            {discoverModeCopy[discoverMode].hint}
          </Text>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle(
            modeExperienceCopy[discoverMode].heading,
            modeExperienceCopy[discoverMode].body
          )}
          <View style={styles.infoStack}>
            {modeExperienceCopy[discoverMode].bullets.map((bullet) => (
              <View key={bullet} style={styles.listRow}>
                <Text style={styles.listRowTitle}>Signal</Text>
                <Text style={styles.listRowText}>{bullet}</Text>
              </View>
            ))}
          </View>
        </View>

        {phoneRecommendedCards.length ? (
          phoneRecommendedCards.map((card) => renderMobileMemberCard(card))
        ) : (
          <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
            {renderPhoneSectionTitle('No matches yet')}
            <Text style={styles.emptyText}>
              Try another mode or category to reopen the network around different skills.
            </Text>
          </View>
        )}

        {secondaryDiscoverCards.length ? (
          <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
            {renderPhoneSectionTitle(
              discoverMode === 'mentor' ? 'Good exchange peers' : 'Great mentor options',
              'Useful people just outside your primary mode'
            )}
            {secondaryDiscoverCards.map((card) => (
              <Pressable
                key={card.id}
                style={({ pressed }) => [styles.listRow, pressed && styles.pressedScale]}
                onPress={() => openMemberDetail(card)}
              >
                <View>
                  <Text style={styles.listRowTitle}>{card.name}</Text>
                  <Text style={styles.listRowText}>
                    {card.skill} · {card.country}
                  </Text>
                </View>
                <Text style={styles.listRowMeta}>
                  {card.persona === 'teacher' ? 'Mentor' : 'Learner'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Saved shortlist')}
          {savedCards.slice(0, 5).map((card) => (
            <View key={card.id} style={styles.listRow}>
              <View>
                <Text style={styles.listRowTitle}>{card.name}</Text>
                <Text style={styles.listRowText}>{card.skill}</Text>
              </View>
              <Text style={styles.listRowMeta}>{card.country}</Text>
            </View>
          ))}
          {!savedCards.length ? (
            <Text style={styles.emptyText}>Save a few profiles to build your shortlist.</Text>
          ) : null}
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Live opportunities', 'Join active community programs')}
          {displayEvents.length ? (
            displayEvents.slice(0, 4).map((event) => (
              <Pressable
                key={event.id}
                style={({ pressed }) => [styles.stackCard, pressed && styles.pressedScale]}
                onPress={() => openEventDetail(event)}
              >
                <Text style={styles.stackCardTitle}>{event.title}</Text>
                <Text style={styles.stackCardText}>{event.participants} attending</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>
              New rooms will appear here as the community calendar fills up.
            </Text>
          )}
        </View>
      </View>
    ) : (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['#0d1d17', '#19372d', '#244d3f']}
        style={[styles.heroPanel, isPhone && styles.heroPanelPhone]}
      >
        <View style={[styles.heroPanelInner, isWide && styles.heroPanelInnerWide]}>
          <View style={styles.heroPanelCopy}>
            <Text style={styles.eyebrow}>{pageMeta.Discover.eyebrow}</Text>
            <Text style={[styles.pageHeroTitle, isPhone && styles.pageHeroTitlePhone]}>
              Welcome back, {user?.name.split(' ')[0]}. Your learning engine is ready.
            </Text>
            <Text style={styles.pageHeroBody}>
              Today’s view combines discovery, relationship signals, active sessions, and suggested next steps into one dashboard.
            </Text>
          </View>
          <View style={[styles.heroStats, isPhone && styles.heroStatsPhone]}>
            {renderStatCard(String(recommendedCards.length), 'Matches', 'Recommended now')}
            {renderStatCard(String(savedCards.length), 'Saved', 'Profiles in shortlist')}
            {renderStatCard(String(unreadNotifications), 'Alerts', 'Unread notifications')}
          </View>
        </View>
      </LinearGradient>

      {renderQuickActions()}

      <View style={[styles.contentColumns, isWide && styles.contentColumnsWide]}>
        <View style={[styles.primaryColumn, isPhone && styles.primaryColumnPhone]}>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <View style={styles.surfaceHeader}>
              <Text style={styles.surfaceTitle}>Discover your next best-fit people</Text>
              <Text style={styles.surfaceHint}>Search and filter the live network below</Text>
            </View>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search mentors, explorers, or skills"
              placeholderTextColor="#7a8a84"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {categories.map((item) => (
                  <Pressable
                    key={item}
                    style={({ pressed }) => [
                      styles.filterChip,
                      category === item && styles.filterChipActive,
                      pressed && styles.pressedScale,
                    ]}
                    onPress={() => setCategory(item)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        category === item && styles.filterChipTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={styles.filterRow}>
              {personas.map((item) => (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.filterChip,
                    persona === item && styles.filterChipActive,
                    pressed && styles.pressedScale,
                  ]}
                  onPress={() => setPersona(item)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      persona === item && styles.filterChipTextActive,
                    ]}
                  >
                    {personaLabel(item)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <View style={styles.surfaceHeader}>
              <Text style={styles.surfaceTitle}>Recommended members</Text>
              <Text style={styles.surfaceHint}>{cards.length} live profiles currently match your filters</Text>
            </View>
            <View style={[styles.memberGrid, isTablet && styles.memberGridTablet]}>
              {recommendedCards.map((card) => renderMemberCard(card))}
            </View>
          </View>
        </View>

        <View style={[styles.secondaryColumn, isPhone && styles.secondaryColumnPhone]}>
          <View style={[styles.darkCard, isPhone && styles.darkCardPhone]}>
            <Text style={styles.darkCardTitle}>Network mix</Text>
            <Text style={styles.darkCardText}>
              {mentorCount} mentors and {learnerCount} explorers currently align with your filter state.
            </Text>
            <View style={styles.mixBar}>
              <View style={[styles.mixMentor, { flex: Math.max(mentorCount, 1) }]} />
              <View style={[styles.mixLearner, { flex: Math.max(learnerCount, 1) }]} />
            </View>
          </View>

          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Saved shortlist</Text>
            {savedCards.slice(0, 3).map((card) => (
              <View key={card.id} style={styles.listRow}>
                <View>
                  <Text style={styles.listRowTitle}>{card.name}</Text>
                  <Text style={styles.listRowText}>{card.skill}</Text>
                </View>
                <Text style={styles.listRowMeta}>{card.country}</Text>
              </View>
            ))}
            {!savedCards.length ? (
              <Text style={styles.emptyText}>Save a few profiles to build your shortlist.</Text>
            ) : null}
          </View>

          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Live opportunities</Text>
            {events.slice(0, 2).map((event) => (
              <View key={event.id} style={styles.stackCard}>
                <Text style={styles.stackCardTitle}>{event.title}</Text>
                <Text style={styles.stackCardText}>{event.participants} attending</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
    )
  );

  const renderSessions = () => (
    isPhone ? (
      <View style={styles.pageStack}>
        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('My bookings', 'Manage sessions, status changes, and follow-through')}
          <View style={[styles.summaryRow, styles.summaryRowPhone]}>
            {renderStatCard(String(upcomingSessions.length), 'Upcoming', 'Booked and ready')}
            {renderStatCard(String(liveSessions.length), 'Live', 'Currently active')}
            {renderStatCard(String(completedSessions.length), 'Done', 'Closed loop')}
          </View>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Upcoming and live')}
          {[...upcomingSessions, ...liveSessions].map((session) => (
            <View key={session.id} style={[styles.sessionCard, styles.sessionCardPhone]}>
              <View style={[styles.rowBetween, styles.rowBetweenPhone]}>
                <View>
                  <Text style={styles.sessionTitle}>{session.skill}</Text>
                  <Text style={styles.sessionMeta}>
                    With {session.with} · {session.time}
                  </Text>
                </View>
                <View
                  style={[
                    styles.sessionStatus,
                    session.status === 'live'
                      ? styles.sessionStatusLive
                      : styles.sessionStatusUpcoming,
                  ]}
                >
                  <Text style={styles.sessionStatusText}>{session.status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={[styles.actionRow, styles.actionRowPhone]}>
                <Pressable
                  style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
                  onPress={() => openSessionDetail(session)}
                >
                  <Text style={styles.ghostButtonText}>View brief</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                  onPress={() => void updateSessionStatus(session, 'upcoming')}
                >
                  <Text style={styles.softButtonText}>Upcoming</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                  onPress={() => void updateSessionStatus(session, 'live')}
                >
                  <Text style={styles.softButtonText}>Live</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                  onPress={() => void updateSessionStatus(session, 'completed')}
                >
                  <Text style={styles.softButtonText}>Complete</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!upcomingSessions.length && !liveSessions.length ? (
            <Text style={styles.emptyText}>Book a session from the dashboard to get started.</Text>
          ) : null}
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Session archive')}
          {completedSessions.map((session) => (
            <Pressable
              key={session.id}
              style={({ pressed }) => [styles.listRow, pressed && styles.pressedScale]}
              onPress={() => openSessionDetail(session)}
            >
              <View>
                <Text style={styles.listRowTitle}>{session.skill}</Text>
                <Text style={styles.listRowText}>{session.with}</Text>
              </View>
              <Text style={styles.listRowMeta}>{session.time}</Text>
            </Pressable>
          ))}
          {!completedSessions.length ? (
            <Text style={styles.emptyText}>Completed sessions will collect here.</Text>
          ) : null}
        </View>
      </View>
    ) : (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['#0d1d17', '#17352b']}
        style={[styles.sectionHero, isPhone && styles.sectionHeroPhone]}
      >
        <Text style={styles.eyebrow}>{pageMeta.Sessions.eyebrow}</Text>
        <Text style={[styles.sectionHeroTitle, isPhone && styles.sectionHeroTitlePhone]}>
          Manage your booked conversations like a real scheduling workspace.
        </Text>
        <Text style={styles.sectionHeroText}>
          Upcoming sessions, live calls, completion states, and calendar exports all sit in one structured flow.
        </Text>
      </LinearGradient>

      <View style={[styles.summaryRow, isPhone && styles.summaryRowPhone]}>
        {renderStatCard(String(upcomingSessions.length), 'Upcoming', 'Booked and ready')}
        {renderStatCard(String(liveSessions.length), 'Live', 'Currently active')}
        {renderStatCard(String(completedSessions.length), 'Completed', 'Closed loop sessions')}
      </View>

      <View style={[styles.contentColumns, isWide && styles.contentColumnsWide]}>
        <View style={[styles.primaryColumn, isPhone && styles.primaryColumnPhone]}>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Upcoming & live</Text>
            {[...upcomingSessions, ...liveSessions].map((session) => (
              <View key={session.id} style={[styles.sessionCard, isPhone && styles.sessionCardPhone]}>
                <View style={[styles.rowBetween, isPhone && styles.rowBetweenPhone]}>
                  <View>
                    <Text style={styles.sessionTitle}>{session.skill}</Text>
                    <Text style={styles.sessionMeta}>
                      With {session.with} · {session.time}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.sessionStatus,
                      session.status === 'live'
                        ? styles.sessionStatusLive
                        : styles.sessionStatusUpcoming,
                    ]}
                  >
                    <Text style={styles.sessionStatusText}>{session.status.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={[styles.actionRow, isPhone && styles.actionRowPhone]}>
                  <Pressable
                    style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                    onPress={() =>
                      api
                        .updateSessionStatus(session.id, 'upcoming')
                        .then((updated) =>
                          setSessions((previous) =>
                            previous.map((item) => (item.id === session.id ? updated : item))
                          )
                        )
                    }
                  >
                    <Text style={styles.softButtonText}>Upcoming</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                    onPress={() =>
                      api
                        .updateSessionStatus(session.id, 'live')
                        .then((updated) =>
                          setSessions((previous) =>
                            previous.map((item) => (item.id === session.id ? updated : item))
                          )
                        )
                    }
                  >
                    <Text style={styles.softButtonText}>Live</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                    onPress={() =>
                      api
                        .updateSessionStatus(session.id, 'completed')
                        .then((updated) =>
                          setSessions((previous) =>
                            previous.map((item) => (item.id === session.id ? updated : item))
                          )
                        )
                    }
                  >
                    <Text style={styles.softButtonText}>Complete</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
                    onPress={() =>
                      globalThis.open?.(
                        `${calendarBaseUrl}${session.calendarUrl}?token=${encodeURIComponent(
                          getAuthToken()
                        )}`,
                        '_blank'
                      )
                    }
                  >
                    <Text style={styles.ghostButtonText}>Calendar</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {!upcomingSessions.length && !liveSessions.length ? (
              <Text style={styles.emptyText}>Book a session from the dashboard to get started.</Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.secondaryColumn, isPhone && styles.secondaryColumnPhone]}>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Session archive</Text>
            {completedSessions.map((session) => (
              <View key={session.id} style={styles.listRow}>
                <View>
                  <Text style={styles.listRowTitle}>{session.skill}</Text>
                  <Text style={styles.listRowText}>{session.with}</Text>
                </View>
                <Text style={styles.listRowMeta}>{session.time}</Text>
              </View>
            ))}
            {!completedSessions.length ? (
              <Text style={styles.emptyText}>Completed sessions will collect here.</Text>
            ) : null}
          </View>

          <View style={[styles.darkCard, isPhone && styles.darkCardPhone]}>
            <Text style={styles.darkCardTitle}>Operator note</Text>
            <Text style={styles.darkCardText}>
              Move sessions to live when they start, then complete them afterward to keep your activity feed and progress accurate.
            </Text>
          </View>
        </View>
      </View>
    </View>
    )
  );

  const renderCommunity = () => (
    isPhone ? (
      <View style={styles.pageStack}>
        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Community events', 'Join curated rooms and small-group sessions')}
          {displayEvents.map((event) => (
            <View key={event.id} style={[styles.eventCard, styles.eventCardPhone]}>
              <View style={[styles.rowBetween, styles.rowBetweenPhone]}>
                <View style={styles.eventCopy}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventText}>{event.description}</Text>
                  <Text style={styles.listRowMeta}>{event.recurringLabel}</Text>
                </View>
                <Text style={styles.eventMeta}>{event.participants}</Text>
              </View>
              <View style={styles.mobileActionRow}>
                <Pressable
                  style={({ pressed }) => [styles.mobileOutlineButton, pressed && styles.pressedScale]}
                  onPress={() => openEventDetail(event)}
                >
                  <Text style={styles.ghostButtonText}>Open room</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.mobilePrimaryButton, pressed && styles.pressedScale]}
                  onPress={() => void joinEvent(event)}
                >
                  <Text style={styles.primaryButtonText}>
                    {event.joined ? 'Joined' : 'Join room'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          <View style={[styles.rowBetween, styles.rowBetweenPhone]}>
            <Text style={styles.surfaceTitle}>Notifications</Text>
            <Pressable
              style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
              onPress={() => api.markNotificationsRead().then(setNotifications)}
            >
              <Text style={styles.softButtonText}>Mark read</Text>
            </Pressable>
          </View>
          {notifications.slice(0, 5).map((notification) => (
            <View key={notification.id} style={styles.notificationItem}>
              <View style={styles.notificationDot} />
              <View style={styles.notificationBody}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationText}>{notification.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Message threads', 'Open the inbox for full conversation flow')}
          {threads.slice(0, 2).map((thread) => (
            <Pressable
              key={thread.id}
              style={({ pressed }) => [styles.threadCard, styles.threadCardPhone, pressed && styles.pressedScale]}
              onPress={() => openThread(thread)}
            >
              <View style={[styles.rowBetween, styles.rowBetweenPhone]}>
                <Text style={styles.threadName}>{thread.participant}</Text>
                <Text style={styles.threadUnread}>{thread.unread} unread</Text>
              </View>
              <Text style={styles.threadTopic}>{thread.topic}</Text>
              <Text style={styles.threadText}>{thread.lastMessage}</Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={openInbox}
          >
            <Text style={styles.primaryWideButtonText}>Open inbox</Text>
          </Pressable>
        </View>
      </View>
    ) : (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['#0d1d17', '#17352b']}
        style={[styles.sectionHero, isPhone && styles.sectionHeroPhone]}
      >
        <Text style={styles.eyebrow}>{pageMeta.Community.eyebrow}</Text>
        <Text style={[styles.sectionHeroTitle, isPhone && styles.sectionHeroTitlePhone]}>
          Your events, inbox, and signals now live in one real communication layer.
        </Text>
        <Text style={styles.sectionHeroText}>
          Instead of generic cards, this section behaves like a proper community workspace.
        </Text>
      </LinearGradient>

      <View style={[styles.contentColumns, isWide && styles.contentColumnsWide]}>
        <View style={[styles.primaryColumn, isPhone && styles.primaryColumnPhone]}>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <View style={styles.surfaceHeader}>
              <Text style={styles.surfaceTitle}>Community events</Text>
              <Text style={styles.surfaceHint}>Join curated rooms and small-group sessions</Text>
            </View>
            {events.map((event) => (
              <View key={event.id} style={[styles.eventCard, isPhone && styles.eventCardPhone]}>
                <View style={[styles.rowBetween, isPhone && styles.rowBetweenPhone]}>
                  <View style={styles.eventCopy}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventText}>{event.description}</Text>
                  </View>
                  <Text style={styles.eventMeta}>{event.participants}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedScale]}
                  onPress={() =>
                    api
                      .joinEvent(event.id)
                      .then((updated) =>
                        setEvents((previous) =>
                          previous.map((item) => (item.id === event.id ? updated : item))
                        )
                      )
                  }
                >
                  <Text style={styles.primaryButtonText}>
                    {event.joined ? 'Joined' : 'Join room'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.secondaryColumn, isPhone && styles.secondaryColumnPhone]}>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <View style={[styles.rowBetween, isPhone && styles.rowBetweenPhone]}>
              <Text style={styles.surfaceTitle}>Notifications</Text>
              <Pressable
                style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                onPress={() => api.markNotificationsRead().then(setNotifications)}
              >
                <Text style={styles.softButtonText}>Mark read</Text>
              </Pressable>
            </View>
            {notifications.slice(0, 5).map((notification) => (
              <View key={notification.id} style={styles.notificationItem}>
                <View style={styles.notificationDot} />
                <View style={styles.notificationBody}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationText}>{notification.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Message threads</Text>
            {threads.map((thread) => (
              <View key={thread.id} style={[styles.threadCard, isPhone && styles.threadCardPhone]}>
                <View style={[styles.rowBetween, isPhone && styles.rowBetweenPhone]}>
                  <Text style={styles.threadName}>{thread.participant}</Text>
                  <Text style={styles.threadUnread}>{thread.unread} unread</Text>
                </View>
                <Text style={styles.threadTopic}>{thread.topic}</Text>
                <Text style={styles.threadText}>{thread.lastMessage}</Text>
                <TextInput
                  style={styles.input}
                  value={drafts[thread.id] ?? ''}
                  onChangeText={(value) =>
                    setDrafts((previous) => ({ ...previous, [thread.id]: value }))
                  }
                  placeholder="Reply"
                  placeholderTextColor="#7a8a84"
                />
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedScale]}
                  onPress={() => {
                    const text = (drafts[thread.id] ?? '').trim();
                    if (!text) return;
                    api.replyThread(thread.id, text).then((updated) => {
                      setThreads((previous) =>
                        previous.map((item) => (item.id === thread.id ? updated : item))
                      );
                    });
                    setDrafts((previous) => ({ ...previous, [thread.id]: '' }));
                  }}
                >
                  <Text style={styles.primaryButtonText}>Send reply</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
    )
  );

  const renderProgress = () => (
    isPhone ? (
      <View style={styles.pageStack}>
        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Progress overview', 'Your current momentum at a glance')}
          <View style={[styles.summaryRow, styles.summaryRowPhone]}>
            {renderStatCard(String(completedCount), 'Milestones', 'Out of 3')}
            {renderStatCard(
              `${plan?.skillsCompleted ?? 0}/${plan?.skillsTarget ?? 0}`,
              'Skills',
              'Completion ratio'
            )}
          </View>
          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={openProgressDetail}
          >
            <Text style={styles.primaryWideButtonText}>Open growth plan</Text>
          </Pressable>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Roadmap')}
          <View style={styles.roadmapTrack}>
            <View
              style={[
                styles.roadmapFill,
                {
                  width: `${((plan?.skillsCompleted ?? 0) / Math.max(plan?.skillsTarget ?? 1, 1)) * 100}%`,
                },
              ]}
            />
          </View>
          <View style={styles.roadmapItem}>
            <Text style={styles.roadmapTitle}>Profile completed</Text>
            <Text style={styles.roadmapState}>{plan?.profileCompleted ? 'Done' : 'Pending'}</Text>
          </View>
          <View style={styles.roadmapItem}>
            <Text style={styles.roadmapTitle}>First session booked</Text>
            <Text style={styles.roadmapState}>{plan?.firstSessionBooked ? 'Done' : 'Pending'}</Text>
          </View>
          <View style={styles.roadmapItem}>
            <Text style={styles.roadmapTitle}>Challenge joined</Text>
            <Text style={styles.roadmapState}>{plan?.challengeJoined ? 'Done' : 'Pending'}</Text>
          </View>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Signals helping progress')}
          <View style={styles.listRow}>
            <Text style={styles.listRowTitle}>Saved profiles</Text>
            <Text style={styles.listRowMeta}>{savedCards.length}</Text>
          </View>
          <View style={styles.listRow}>
            <Text style={styles.listRowTitle}>Upcoming sessions</Text>
            <Text style={styles.listRowMeta}>{upcomingSessions.length}</Text>
          </View>
          <View style={styles.listRow}>
            <Text style={styles.listRowTitle}>Joined events</Text>
            <Text style={styles.listRowMeta}>{events.filter((item) => item.joined).length}</Text>
          </View>
        </View>
      </View>
    ) : (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['#0d1d17', '#17352b']}
        style={[styles.sectionHero, isPhone && styles.sectionHeroPhone]}
      >
        <Text style={styles.eyebrow}>{pageMeta.Progress.eyebrow}</Text>
        <Text style={[styles.sectionHeroTitle, isPhone && styles.sectionHeroTitlePhone]}>
          Treat progress like an operating system, not a checklist.
        </Text>
        <Text style={styles.sectionHeroText}>
          This view keeps the goal structure clear: finish setup, book momentum, and deepen community participation.
        </Text>
      </LinearGradient>

      <View style={[styles.summaryRow, isPhone && styles.summaryRowPhone]}>
        {renderStatCard(String(completedCount), 'Milestones', 'Out of the current 3')}
        {renderStatCard(
          `${plan?.skillsCompleted ?? 0}/${plan?.skillsTarget ?? 0}`,
          'Skills target',
          'Current completion ratio'
        )}
        {renderStatCard(String(connectedCards.length), 'Connections', 'People already engaged')}
      </View>

      <View style={[styles.contentColumns, isWide && styles.contentColumnsWide]}>
        <View style={[styles.primaryColumn, isPhone && styles.primaryColumnPhone]}>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Roadmap</Text>
            <View style={styles.roadmapTrack}>
              <View
                style={[
                  styles.roadmapFill,
                  {
                    width: `${((plan?.skillsCompleted ?? 0) / Math.max(plan?.skillsTarget ?? 1, 1)) * 100}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.roadmapItem}>
              <Text style={styles.roadmapTitle}>Profile completed</Text>
              <Text style={styles.roadmapState}>
                {plan?.profileCompleted ? 'Done' : 'Pending'}
              </Text>
            </View>
            <View style={styles.roadmapItem}>
              <Text style={styles.roadmapTitle}>First session booked</Text>
              <Text style={styles.roadmapState}>
                {plan?.firstSessionBooked ? 'Done' : 'Pending'}
              </Text>
            </View>
            <View style={styles.roadmapItem}>
              <Text style={styles.roadmapTitle}>Challenge joined</Text>
              <Text style={styles.roadmapState}>
                {plan?.challengeJoined ? 'Done' : 'Pending'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.secondaryColumn, isPhone && styles.secondaryColumnPhone]}>
          <View style={[styles.darkCard, isPhone && styles.darkCardPhone]}>
            <Text style={styles.darkCardTitle}>Next best move</Text>
            <Text style={styles.darkCardText}>
              Book one session in a new category and reply to one active thread to make this growth loop feel materially stronger.
            </Text>
          </View>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Signals helping progress</Text>
            <View style={styles.listRow}>
              <Text style={styles.listRowTitle}>Saved profiles</Text>
              <Text style={styles.listRowMeta}>{savedCards.length}</Text>
            </View>
            <View style={styles.listRow}>
              <Text style={styles.listRowTitle}>Upcoming sessions</Text>
              <Text style={styles.listRowMeta}>{upcomingSessions.length}</Text>
            </View>
            <View style={styles.listRow}>
              <Text style={styles.listRowTitle}>Joined events</Text>
              <Text style={styles.listRowMeta}>{events.filter((item) => item.joined).length}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
    )
  );

  const renderProfile = () => (
    isPhone ? (
      <View style={styles.pageStack}>
        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Profile')}
          <Text style={styles.surfaceTitle}>{user?.name}</Text>
          <Text style={styles.profileHeadline}>{user?.headline}</Text>
          <Text style={styles.profileSubline}>
            {user?.country} · {user?.email}
          </Text>
          <Text style={styles.profileBio}>{user?.bio}</Text>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Quick summary')}
          <View style={styles.compactSummaryRow}>
            <View style={styles.compactMetric}>
              <Text style={styles.compactMetricValue}>{String((user?.skillsOffered ?? []).length)}</Text>
              <Text style={styles.compactMetricLabel}>Offer skills</Text>
            </View>
            <View style={styles.compactMetric}>
              <Text style={styles.compactMetricValue}>{String((user?.skillsToLearn ?? []).length)}</Text>
              <Text style={styles.compactMetricLabel}>Learning skills</Text>
            </View>
            <View style={styles.compactMetric}>
              <Text style={styles.compactMetricValue}>{String((user?.verifiedSkills ?? []).length)}</Text>
              <Text style={styles.compactMetricLabel}>Verified</Text>
            </View>
          </View>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Skills offered')}
          <View style={styles.tagWrap}>
            {(user?.skillsOffered ?? []).map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Learning next')}
          <View style={styles.tagWrap}>
            {(user?.skillsToLearn ?? []).map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Verified skills')}
          <View style={styles.tagWrap}>
            {(user?.verifiedSkills ?? []).map((item) => (
              <View key={item} style={styles.microBadge}>
                <Text style={styles.microBadgeText}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.infoLabel}>Portfolio projects</Text>
          <View style={styles.infoStack}>
            {(user?.portfolioProjects ?? []).map((item) => (
              <View key={item} style={styles.listRow}>
                <Text style={styles.listRowTitle}>Project</Text>
                <Text style={styles.listRowText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Portfolio media')}
          <View style={styles.infoStack}>
            {portfolioAssets.map((item) => (
              <View key={item.id} style={styles.listRow}>
                <View style={styles.listRowBody}>
                  <Text style={styles.listRowTitle}>{item.kind.toUpperCase()}</Text>
                  <Text style={styles.listRowText}>{item.title}</Text>
                  <Text style={styles.listRowMeta}>{item.url}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
                  onPress={() => void removePortfolioAsset(item.id)}
                >
                  <Text style={styles.ghostButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={assetTitle}
            onChangeText={setAssetTitle}
            placeholder="Asset title"
            placeholderTextColor="#7a8a84"
          />
          <TextInput
            style={styles.input}
            value={assetUrl}
            onChangeText={setAssetUrl}
            placeholder="Hosted media URL"
            placeholderTextColor="#7a8a84"
            autoCapitalize="none"
          />
          <View style={styles.tagWrap}>
            {(['link', 'image', 'video', 'doc'] as const).map((kind) => (
              <Pressable
                key={kind}
                style={({ pressed }) => [
                  styles.filterChip,
                  assetKind === kind && styles.filterChipActive,
                  pressed && styles.pressedScale,
                ]}
                onPress={() => setAssetKind(kind)}
              >
                <Text style={[styles.filterChipText, assetKind === kind && styles.filterChipTextActive]}>
                  {kind}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={() => void addPortfolioAsset()}
          >
            <Text style={styles.primaryWideButtonText}>Add media</Text>
          </Pressable>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Exchange focus')}
          <Text style={styles.infoLabel}>What I can help with</Text>
          <View style={styles.tagWrap}>
            {(user?.helpOffered ?? []).map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.infoLabel}>What I want help with</Text>
          <View style={styles.tagWrap}>
            {(user?.helpWanted ?? []).map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Social proof')}
          <View style={styles.infoStack}>
            {(user?.endorsements ?? []).map((item) => (
              <View key={item} style={styles.listRow}>
                <Text style={styles.listRowTitle}>Endorsement</Text>
                <Text style={styles.listRowText}>{item}</Text>
              </View>
            ))}
            {(user?.reviews ?? []).map((item) => (
              <View key={item} style={styles.listRow}>
                <Text style={styles.listRowTitle}>Review</Text>
                <Text style={styles.listRowText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {user?.operatorMode && adminDashboard ? (
          <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
            {renderPhoneSectionTitle('Operator mode')}
            <Text style={styles.profileBio}>
              Monitor featured mentors, room health, reports, and booking quality from one admin surface.
            </Text>
            <View style={styles.infoStack}>
              {adminDashboard.featuredMentors.map((mentor) => (
                <View key={mentor.id} style={styles.listRow}>
                  <View style={styles.listRowBody}>
                    <Text style={styles.listRowTitle}>{mentor.featured ? 'FEATURED' : 'MENTOR'}</Text>
                    <Text style={styles.listRowText}>{mentor.name}</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                    onPress={() => void toggleFeaturedMentor(mentor)}
                  >
                    <Text style={styles.softButtonText}>{mentor.featured ? 'Unfeature' : 'Feature'}</Text>
                  </Pressable>
                </View>
              ))}
              {adminDashboard.reports.map((report) => (
                <View key={report.id} style={styles.listRow}>
                  <View style={styles.listRowBody}>
                    <Text style={styles.listRowTitle}>
                      {report.severity.toUpperCase()} · {report.status.toUpperCase()}
                    </Text>
                    <Text style={styles.listRowText}>{report.label}</Text>
                  </View>
                  {report.status !== 'resolved' ? (
                    <Pressable
                      style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
                      onPress={() => void resolveOperatorReport(report)}
                    >
                      <Text style={styles.ghostButtonText}>Resolve</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
          onPress={onNativeAction(() => {
            setOnboardingStep(0);
            setProfileModal(true);
          })}
        >
          <Text style={styles.primaryWideButtonText}>Edit onboarding</Text>
        </Pressable>
      </View>
    ) : (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['#0d1d17', '#17352b']}
        style={[styles.sectionHero, isPhone && styles.sectionHeroPhone]}
      >
        <Text style={styles.eyebrow}>{pageMeta.Profile.eyebrow}</Text>
        <Text style={[styles.sectionHeroTitle, isPhone && styles.sectionHeroTitlePhone]}>
          Your member profile is now treated like the center of the product.
        </Text>
        <Text style={styles.sectionHeroText}>
          Identity, offering, and learning intent are organized as a proper profile surface instead of scattered fields.
        </Text>
      </LinearGradient>

      <View style={[styles.contentColumns, isWide && styles.contentColumnsWide]}>
        <View style={[styles.primaryColumn, isPhone && styles.primaryColumnPhone]}>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>{user?.name}</Text>
            <Text style={styles.profileHeadline}>{user?.headline}</Text>
            <Text style={styles.profileSubline}>
              {user?.country} · {user?.email}
            </Text>
            <Text style={styles.profileBio}>{user?.bio}</Text>
          </View>
        </View>

        <View style={[styles.secondaryColumn, isPhone && styles.secondaryColumnPhone]}>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Skills offered</Text>
            <View style={styles.tagWrap}>
              {(user?.skillsOffered ?? []).map((item) => (
                <View key={item} style={styles.tag}>
                  <Text style={styles.tagText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Learning next</Text>
            <View style={styles.tagWrap}>
              {(user?.skillsToLearn ?? []).map((item) => (
                <View key={item} style={styles.tag}>
                  <Text style={styles.tagText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Verified skills</Text>
            <View style={styles.tagWrap}>
              {(user?.verifiedSkills ?? []).map((item) => (
                <View key={item} style={styles.microBadge}>
                  <Text style={styles.microBadgeText}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.infoLabel}>Portfolio projects</Text>
            <View style={styles.infoStack}>
              {(user?.portfolioProjects ?? []).map((item) => (
                <View key={item} style={styles.listRow}>
                  <Text style={styles.listRowTitle}>Project</Text>
                  <Text style={styles.listRowText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Portfolio media</Text>
            <View style={styles.infoStack}>
              {portfolioAssets.map((item) => (
                <View key={item.id} style={styles.listRow}>
                  <View style={styles.listRowBody}>
                    <Text style={styles.listRowTitle}>{item.kind.toUpperCase()}</Text>
                    <Text style={styles.listRowText}>{item.title}</Text>
                    <Text style={styles.listRowMeta}>{item.url}</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
                    onPress={() => void removePortfolioAsset(item.id)}
                  >
                    <Text style={styles.ghostButtonText}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={assetTitle}
              onChangeText={setAssetTitle}
              placeholder="Asset title"
              placeholderTextColor="#7a8a84"
            />
            <TextInput
              style={styles.input}
              value={assetUrl}
              onChangeText={setAssetUrl}
              placeholder="Hosted media URL"
              placeholderTextColor="#7a8a84"
              autoCapitalize="none"
            />
            <View style={styles.tagWrap}>
              {(['link', 'image', 'video', 'doc'] as const).map((kind) => (
                <Pressable
                  key={kind}
                  style={({ pressed }) => [
                    styles.filterChip,
                    assetKind === kind && styles.filterChipActive,
                    pressed && styles.pressedScale,
                  ]}
                  onPress={() => setAssetKind(kind)}
                >
                  <Text style={[styles.filterChipText, assetKind === kind && styles.filterChipTextActive]}>
                    {kind}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
              onPress={() => void addPortfolioAsset()}
            >
              <Text style={styles.primaryWideButtonText}>Add media</Text>
            </Pressable>
          </View>

          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Exchange focus</Text>
            <Text style={styles.infoLabel}>What I can help with</Text>
            <View style={styles.tagWrap}>
              {(user?.helpOffered ?? []).map((item) => (
                <View key={item} style={styles.tag}>
                  <Text style={styles.tagText}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.infoLabel}>What I want help with</Text>
            <View style={styles.tagWrap}>
              {(user?.helpWanted ?? []).map((item) => (
                <View key={item} style={styles.tag}>
                  <Text style={styles.tagText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Endorsements and reviews</Text>
            <View style={styles.infoStack}>
              {(user?.endorsements ?? []).map((item) => (
                <View key={item} style={styles.listRow}>
                  <Text style={styles.listRowTitle}>Endorsement</Text>
                  <Text style={styles.listRowText}>{item}</Text>
                </View>
              ))}
              {(user?.reviews ?? []).map((item) => (
                <View key={item} style={styles.listRow}>
                  <Text style={styles.listRowTitle}>Review</Text>
                  <Text style={styles.listRowText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {user?.operatorMode && adminDashboard ? (
            <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
              <Text style={styles.surfaceTitle}>Operator mode</Text>
              <Text style={styles.profileBio}>
                Curate featured mentors, review room health, watch booking quality, and keep the network clean.
              </Text>
              <View style={styles.infoStack}>
                {adminDashboard.trendingSkills.map((item) => (
                  <View key={item} style={styles.listRow}>
                    <Text style={styles.listRowTitle}>Trending</Text>
                    <Text style={styles.listRowText}>{item}</Text>
                  </View>
                ))}
                {adminDashboard.reports.map((report) => (
                  <View key={report.id} style={styles.listRow}>
                    <View style={styles.listRowBody}>
                      <Text style={styles.listRowTitle}>
                        {report.severity.toUpperCase()} · {report.status.toUpperCase()}
                      </Text>
                      <Text style={styles.listRowText}>{report.label}</Text>
                    </View>
                    {report.status !== 'resolved' ? (
                      <Pressable
                        style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
                        onPress={() => void resolveOperatorReport(report)}
                      >
                        <Text style={styles.ghostButtonText}>Resolve</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {adminDashboard.featuredMentors.map((mentor) => (
                  <View key={mentor.id} style={styles.listRow}>
                    <View style={styles.listRowBody}>
                      <Text style={styles.listRowTitle}>{mentor.featured ? 'FEATURED' : 'MENTOR'}</Text>
                      <Text style={styles.listRowText}>{mentor.name}</Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                      onPress={() => void toggleFeaturedMentor(mentor)}
                    >
                      <Text style={styles.softButtonText}>{mentor.featured ? 'Unfeature' : 'Feature'}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={onNativeAction(() => {
              setOnboardingStep(0);
              setProfileModal(true);
            })}
          >
            <Text style={styles.primaryWideButtonText}>Edit onboarding</Text>
          </Pressable>
        </View>
      </View>
    </View>
    )
  );

  const renderMemberDetailPage = () => (
    <View style={styles.pageStack}>
      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        <View style={styles.rowBetween}>
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>
              {currentRoute?.kind === 'member' && currentRoute.card.persona === 'teacher'
                ? 'MENTOR BRIEF'
                : 'EXPLORER BRIEF'}
            </Text>
          </View>
          <Text style={styles.memberRating}>
            {currentRoute?.kind === 'member' ? currentRoute.card.rating.toFixed(1) : ''}
          </Text>
        </View>
        <Text style={styles.surfaceTitle}>
          {currentRoute?.kind === 'member' ? currentRoute.card.name : ''}
        </Text>
        <Text style={styles.profileHeadline}>
          {currentRoute?.kind === 'member'
            ? `${currentRoute.card.title} · ${currentRoute.card.country}`
            : ''}
        </Text>
        <Text style={styles.profileBio}>
          {currentRoute?.kind === 'member' ? currentRoute.card.bio : ''}
        </Text>
        <View style={styles.trustBadgeRow}>
          {activeMemberInsight?.trustBadges.map((badge) => (
            <View key={badge} style={styles.microBadge}>
              <Text style={styles.microBadgeText}>{badge}</Text>
            </View>
          ))}
        </View>
        <View style={styles.compactSummaryRow}>
          <View style={styles.compactMetric}>
            <Text style={styles.compactMetricValue}>
              {String(activeMemberInsight?.completedSessions ?? 0)}
            </Text>
            <Text style={styles.compactMetricLabel}>Completed</Text>
          </View>
          <View style={styles.compactMetric}>
            <Text style={styles.compactMetricValue}>
              {String(activeMemberInsight?.repeatLearners ?? 0)}
            </Text>
            <Text style={styles.compactMetricLabel}>Repeat learners</Text>
          </View>
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Offer snapshot')}
        <View style={styles.infoStack}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Focus skill</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'member' ? currentRoute.card.skill : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'member' ? currentRoute.card.category : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Open slots</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'member'
                ? currentRoute.card.nextSessionSlots.slice(0, 3).join(' · ')
                : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reply speed</Text>
            <Text style={styles.infoValue}>{activeMemberInsight?.responseTime ?? ''}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Session goal</Text>
            <Text style={styles.infoValueSoft}>{activeMemberInsight?.sessionGoal ?? ''}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Why this match feels strong')}
        <View style={styles.premiumNoteCard}>
          <Text style={styles.premiumNoteTitle}>{activeMemberInsight?.proof ?? ''}</Text>
          <Text style={styles.premiumNoteBody}>
            {currentRoute?.kind === 'member'
              ? `${currentRoute.card.name} is positioned for a focused ${currentRoute.card.skill.toLowerCase()} exchange with strong follow-through and clear availability.`
              : ''}
          </Text>
        </View>
        <Text style={styles.memberSignal}>{activeMemberInsight?.endorsement ?? ''}</Text>
        <View style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>Member feedback</Text>
          <Text style={styles.quoteText}>
            "{activeMemberInsight?.testimonial ?? ''}"
          </Text>
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('What they can help with')}
        <View style={styles.tagWrap}>
          {(currentRoute?.kind === 'member' ? currentRoute.card.helpOffered ?? [] : []).map((item) => (
            <View key={item} style={styles.tag}>
              <Text style={styles.tagText}>{item}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.infoLabel}>They want help with</Text>
        <View style={styles.tagWrap}>
          {(currentRoute?.kind === 'member' ? currentRoute.card.helpWanted ?? [] : []).map((item) => (
            <View key={item} style={styles.tag}>
              <Text style={styles.tagText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Portfolio and proof')}
        <View style={styles.infoStack}>
          {(currentRoute?.kind === 'member' ? currentRoute.card.portfolioProjects ?? [] : []).map((item) => (
            <View key={item} style={styles.listRow}>
              <Text style={styles.listRowTitle}>Project</Text>
              <Text style={styles.listRowText}>{item}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.infoLabel}>Verified skills</Text>
        <View style={styles.tagWrap}>
          {(currentRoute?.kind === 'member' ? currentRoute.card.verifiedSkills ?? [] : []).map((item) => (
            <View key={item} style={styles.microBadge}>
              <Text style={styles.microBadgeText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Reviews and endorsements')}
        <View style={styles.infoStack}>
          {(currentRoute?.kind === 'member' ? currentRoute.card.endorsements ?? [] : []).map((item) => (
            <View key={item} style={styles.listRow}>
              <Text style={styles.listRowTitle}>Endorsement</Text>
              <Text style={styles.listRowText}>{item}</Text>
            </View>
          ))}
          {(currentRoute?.kind === 'member' ? currentRoute.card.reviews ?? [] : []).map((item) => (
            <View key={item} style={styles.listRow}>
              <Text style={styles.listRowTitle}>Review</Text>
              <Text style={styles.listRowText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Actions')}
        <View style={styles.actionRowPhone}>
          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'member') return;
              openBookingPage(currentRoute.card);
            }}
          >
            <Text style={styles.primaryWideButtonText}>Book session</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'member') return;
              void api.toggleFavorite(currentRoute.card.id).then((updated) => {
                updateCard(currentRoute.card.id, updated);
                replaceRoute({ kind: 'member', card: updated });
              });
            }}
          >
            <Text style={styles.softButtonText}>
              {currentRoute?.kind === 'member' && currentRoute.card.favorited
                ? 'Saved profile'
                : 'Save profile'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'member') return;
              void api.toggleConnect(currentRoute.card.id).then((updated) => {
                updateCard(currentRoute.card.id, updated);
                replaceRoute({ kind: 'member', card: updated });
              });
            }}
          >
            <Text style={styles.ghostButtonText}>
              {currentRoute?.kind === 'member' && currentRoute.card.connected
                ? 'Connected'
                : 'Connect'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderSessionDetailPage = () => (
    <View style={styles.pageStack}>
      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        <Text style={styles.surfaceTitle}>
          {currentRoute?.kind === 'session' ? currentRoute.session.skill : ''}
        </Text>
        <Text style={styles.profileHeadline}>
          With {currentRoute?.kind === 'session' ? currentRoute.session.with : ''}
        </Text>
        <Text style={styles.profileBio}>
          {currentRoute?.kind === 'session'
            ? `${currentRoute.session.status.toUpperCase()} · ${currentRoute.session.time}`
            : ''}
        </Text>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Session brief')}
        <View style={styles.infoStack}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'session' ? currentRoute.session.status : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Meeting state</Text>
            <Text style={styles.infoValueSoft}>
              {currentRoute?.kind === 'session'
                ? getSessionPlaybook(currentRoute.session).meetingState
                : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Best format</Text>
            <Text style={styles.infoValueSoft}>
              {currentRoute?.kind === 'session'
                ? getSessionPlaybook(currentRoute.session).formatHint
                : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Next step</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'session' && currentRoute.session.status === 'completed'
                ? 'Archive and reflect'
                : currentRoute?.kind === 'session' && currentRoute.session.status === 'live'
                  ? 'Stay in session'
                  : 'Prepare notes and goals'}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Prep checklist')}
        <View style={styles.infoStack}>
          {currentRoute?.kind === 'session'
            ? getSessionPlaybook(currentRoute.session).prepChecklist.map((item) => (
                <View key={item} style={styles.listRow}>
                  <Text style={styles.listRowTitle}>Prep</Text>
                  <Text style={styles.listRowText}>{item}</Text>
                </View>
              ))
            : null}
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Resources queued')}
        <View style={styles.infoStack}>
          {currentRoute?.kind === 'session'
            ? getSessionPlaybook(currentRoute.session).resources.map((item) => (
                <View key={item} style={styles.listRow}>
                  <Text style={styles.listRowTitle}>Ready</Text>
                  <Text style={styles.listRowText}>{item}</Text>
                </View>
              ))
            : null}
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Manage booking')}
        <View style={styles.actionRowPhone}>
          {currentRoute?.kind === 'session' && currentRoute.session.cardId ? (
            <Pressable
              style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
              onPress={() => {
                const card = getCardById(currentRoute.session.cardId);
                if (card) {
                  openBookingPage(card);
                }
              }}
            >
              <Text style={styles.primaryWideButtonText}>Reschedule</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'session') return;
              void api.updateSession(currentRoute.session.id, { status: 'upcoming' }).then((updated) => {
                setSessions((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
                replaceRoute({ kind: 'session', session: updated });
              });
            }}
          >
            <Text style={styles.softButtonText}>Mark upcoming</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'session') return;
              void api.updateSession(currentRoute.session.id, { status: 'live' }).then((updated) => {
                setSessions((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
                replaceRoute({ kind: 'session', session: updated });
              });
            }}
          >
            <Text style={styles.softButtonText}>Mark live</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'session') return;
              void api.updateSession(currentRoute.session.id, { status: 'completed' }).then((updated) => {
                setSessions((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
                replaceRoute({ kind: 'session', session: updated });
              });
            }}
          >
            <Text style={styles.softButtonText}>Complete</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'session') return;
              void api.updateSession(currentRoute.session.id, { reminderSet: true }).then((updated) => {
                setSessions((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
                replaceRoute({ kind: 'session', session: updated });
              });
            }}
          >
            <Text style={styles.softButtonText}>
              {currentRoute?.kind === 'session' && currentRoute.session.reminderSet
                ? 'Reminder active'
                : 'Send reminder'}
            </Text>
          </Pressable>
          {currentRoute?.kind === 'session' && currentRoute.session.cardId ? (
            <Pressable
              style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
              onPress={() => {
                const card = getCardById(currentRoute.session.cardId);
                if (card) {
                  openMemberDetail(card);
                }
              }}
            >
              <Text style={styles.ghostButtonText}>Open member</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Follow-through')}
        <Text style={styles.profileBio}>
          {currentRoute?.kind === 'session'
            ? getSessionPlaybook(currentRoute.session).followUp
            : ''}
        </Text>
      </View>
    </View>
  );

  const renderEventDetailPage = () => (
    <View style={styles.pageStack}>
      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        <Text style={styles.surfaceTitle}>
          {currentRoute?.kind === 'event' ? currentRoute.event.title : ''}
        </Text>
        <Text style={styles.profileBio}>
          {currentRoute?.kind === 'event' ? currentRoute.event.description : ''}
        </Text>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Room details')}
        <View style={styles.infoStack}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Format</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'event'
                ? currentRoute.event.format ?? 'Community room'
                : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Host</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'event'
                ? currentRoute.event.host ?? 'SkillSwap community'
                : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Attendees</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'event' ? currentRoute.event.participants : 0}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Track</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'event' ? currentRoute.event.category ?? 'General' : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Room agenda')}
        <View style={styles.infoStack}>
          {currentRoute?.kind === 'event'
            ? getEventGuide(currentRoute.event).agenda.map((item) => (
                <View key={item} style={styles.listRow}>
                  <Text style={styles.listRowTitle}>Agenda</Text>
                  <Text style={styles.listRowText}>{item}</Text>
                </View>
              ))
            : null}
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Attendee mix')}
        <View style={styles.trustBadgeRow}>
          {currentRoute?.kind === 'event'
            ? getEventGuide(currentRoute.event).attendees.map((item) => (
                <View key={item} style={styles.microBadge}>
                  <Text style={styles.microBadgeText}>{item}</Text>
                </View>
              ))
            : null}
        </View>
        <Text style={styles.profileBio}>
          {currentRoute?.kind === 'event' ? getEventGuide(currentRoute.event).reminder : ''}
        </Text>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Room discussion')}
        <View style={styles.infoStack}>
          {(currentRoute?.kind === 'event'
            ? roomDiscussionByEvent[currentRoute.event.id] ?? []
            : []
          ).map((item) => (
            <View key={item.id} style={styles.listRow}>
              <View style={styles.listRowBody}>
                <Text style={styles.listRowTitle}>
                  {item.author} · {item.role}
                </Text>
                <Text style={styles.listRowText}>{item.message}</Text>
                <Text style={styles.listRowMeta}>
                  {item.pinned ? 'Pinned update' : new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={currentRoute?.kind === 'event' ? roomDrafts[currentRoute.event.id] ?? '' : ''}
          onChangeText={(value) => {
            if (currentRoute?.kind !== 'event') return;
            setRoomDrafts((previous) => ({ ...previous, [currentRoute.event.id]: value }));
          }}
          placeholder="Share a question, context note, or takeaway"
          placeholderTextColor="#7a8a84"
          multiline
        />
        <Pressable
          style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
          onPress={() => {
            if (currentRoute?.kind !== 'event') return;
            const text = (roomDrafts[currentRoute.event.id] ?? '').trim();
            if (!text) return;
            void api.postEventDiscussion(currentRoute.event.id, text).then((created) => {
              setRoomDiscussionByEvent((previous) => ({
                ...previous,
                [currentRoute.event.id]: [...(previous[currentRoute.event.id] ?? []), created],
              }));
              setRoomDrafts((previous) => ({ ...previous, [currentRoute.event.id]: '' }));
            });
          }}
        >
          <Text style={styles.primaryWideButtonText}>Post to room</Text>
        </Pressable>
      </View>

      {user?.operatorMode && currentRoute?.kind === 'event' ? (
        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Operator recap')}
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={adminRecapDrafts[currentRoute.event.id] ?? ''}
            onChangeText={(value) =>
              setAdminRecapDrafts((previous) => ({ ...previous, [currentRoute.event.id]: value }))
            }
            placeholder="Write the room recap for participants"
            placeholderTextColor="#7a8a84"
            multiline
          />
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => void saveEventRecap(currentRoute.event.id)}
          >
            <Text style={styles.softButtonText}>Publish recap</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Actions')}
        <View style={styles.actionRowPhone}>
          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'event') return;
              void joinEvent(currentRoute.event).then(() => {
                const nextEvent =
                  displayEvents.find((item) => item.id === currentRoute.event.id) || {
                    ...currentRoute.event,
                    joined: true,
                    participants: currentRoute.event.participants + 1,
                  };
                replaceRoute({ kind: 'event', event: nextEvent });
              });
            }}
          >
            <Text style={styles.primaryWideButtonText}>
              {currentRoute?.kind === 'event' && currentRoute.event.joined ? 'Joined room' : 'Join room'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'event') return;
              void api.toggleEventReminder(currentRoute.event.id).then((updated) => {
                setEvents((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
                replaceRoute({ kind: 'event', event: updated });
              });
            }}
          >
            <Text style={styles.softButtonText}>
              {currentRoute?.kind === 'event' && currentRoute.event.reminderSet
                ? 'Reminder active'
                : 'Set reminder'}
            </Text>
          </Pressable>
          {currentRoute?.kind === 'event' && currentRoute.event.host ? (
            <Pressable
              style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
              onPress={() => {
                const hostCard = getCardByName(currentRoute.event.host || '');
                if (hostCard) {
                  openMemberDetail(hostCard);
                }
              }}
            >
              <Text style={styles.softButtonText}>Open host</Text>
            </Pressable>
          ) : null}
          {currentRoute?.kind === 'event' && getThreadById(currentRoute.event.threadId) ? (
            <Pressable
              style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
              onPress={() => {
                const thread = getThreadById(currentRoute.event.threadId);
                if (thread) {
                  openThread(thread);
                }
              }}
            >
              <Text style={styles.ghostButtonText}>Open discussion</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind === 'event' && currentRoute.event.category) {
                setCategory(currentRoute.event.category);
              }
              setActiveTab('Discover');
              closeDetailPage();
            }}
          >
            <Text style={styles.softButtonText}>See matching people</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderProgressDetailPage = () => (
    <View style={styles.pageStack}>
      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        <Text style={styles.surfaceTitle}>Growth plan</Text>
        <Text style={styles.profileBio}>
          SkillsSwap works best when profile quality, bookings, and community loops move together.
        </Text>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Current plan')}
        <View style={styles.infoStack}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Profile completed</Text>
            <Text style={styles.infoValue}>{plan?.profileCompleted ? 'Done' : 'Pending'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>First booking</Text>
            <Text style={styles.infoValue}>{plan?.firstSessionBooked ? 'Done' : 'Pending'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Community joined</Text>
            <Text style={styles.infoValue}>{plan?.challengeJoined ? 'Done' : 'Pending'}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Next move')}
        <View style={styles.actionRowPhone}>
          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={() => {
              setActiveTab('Sessions');
              closeDetailPage();
            }}
          >
            <Text style={styles.primaryWideButtonText}>Go to bookings</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => {
              setActiveTab('Community');
              closeDetailPage();
            }}
          >
            <Text style={styles.softButtonText}>Open rooms</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderInboxPage = () => (
    <View style={styles.pageStack}>
      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        <View style={[styles.rowBetween, styles.rowBetweenPhone]}>
          {renderPhoneSectionTitle('Inbox overview', `${messages.unreadCount} unread conversations`)}
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => api.markMessagesRead().then(setMessages)}
          >
            <Text style={styles.softButtonText}>Mark all read</Text>
          </Pressable>
        </View>
        <View style={styles.compactSummaryRow}>
          <View style={styles.compactMetric}>
            <Text style={styles.compactMetricValue}>{String(messages.humanUnread ?? 0)}</Text>
            <Text style={styles.compactMetricLabel}>Human</Text>
          </View>
          <View style={styles.compactMetric}>
            <Text style={styles.compactMetricValue}>{String(messages.bookingUnread ?? 0)}</Text>
            <Text style={styles.compactMetricLabel}>Booking</Text>
          </View>
          <View style={styles.compactMetric}>
            <Text style={styles.compactMetricValue}>{String(messages.systemUnread ?? 0)}</Text>
            <Text style={styles.compactMetricLabel}>System</Text>
          </View>
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('People and booking threads')}
        {humanThreads.map((thread) => (
          <Pressable
            key={thread.id}
            style={({ pressed }) => [
              styles.threadCard,
              styles.threadCardPhone,
              pressed && styles.pressedScale,
            ]}
            onPress={() => openThread(thread)}
          >
            <View style={[styles.rowBetween, styles.rowBetweenPhone]}>
              <Text style={styles.threadName}>{thread.participant}</Text>
              <Text style={styles.threadUnread}>{thread.unread} unread</Text>
            </View>
            <Text style={styles.threadTopic}>{thread.topic}</Text>
            <Text style={styles.threadText}>{thread.lastMessage}</Text>
            <Text style={styles.listRowMeta}>{thread.category}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('System and room alerts')}
        {systemNotifications.slice(0, 4).map((notification) => (
          <View key={notification.id} style={styles.notificationItem}>
            <View style={styles.notificationDot} />
            <View style={styles.notificationBody}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationText}>{notification.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        <View style={[styles.rowBetween, styles.rowBetweenPhone]}>
          <Text style={styles.surfaceTitle}>Human and booking alerts</Text>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => api.markNotificationsRead().then(setNotifications)}
          >
            <Text style={styles.softButtonText}>Mark read</Text>
          </Pressable>
        </View>
        {humanNotifications.slice(0, 6).map((notification) => (
          <View key={notification.id} style={styles.notificationItem}>
            <View style={styles.notificationDot} />
            <View style={styles.notificationBody}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationText}>{notification.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderThreadDetailPage = () => (
    <View style={styles.pageStack}>
      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        <Text style={styles.surfaceTitle}>
          {currentRoute?.kind === 'thread' ? currentRoute.thread.participant : ''}
        </Text>
        <Text style={styles.profileHeadline}>
          {currentRoute?.kind === 'thread' ? currentRoute.thread.topic : ''}
        </Text>
        <Text style={styles.profileBio}>
          {currentRoute?.kind === 'thread' ? currentRoute.thread.lastMessage : ''}
        </Text>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Reply')}
        <View style={styles.tagWrap}>
          {(currentRoute?.kind === 'thread' ? currentRoute.thread.quickReplies ?? [] : []).map((item) => (
            <Pressable
              key={item}
              style={({ pressed }) => [styles.tag, pressed && styles.pressedScale]}
              onPress={() => {
                if (currentRoute?.kind !== 'thread') return;
                setDrafts((previous) => ({ ...previous, [currentRoute.thread.id]: item }));
              }}
            >
              <Text style={styles.tagText}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={currentRoute?.kind === 'thread' ? drafts[currentRoute.thread.id] ?? '' : ''}
          onChangeText={(value) => {
            if (currentRoute?.kind !== 'thread') return;
            setDrafts((previous) => ({ ...previous, [currentRoute.thread.id]: value }));
          }}
          placeholder="Write your reply"
          placeholderTextColor="#7a8a84"
          multiline
        />
        <View style={styles.actionRowPhone}>
          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'thread') return;
              const text = (drafts[currentRoute.thread.id] ?? '').trim();
              if (!text) return;
              api.replyThread(currentRoute.thread.id, text).then((updated) => {
                setThreads((previous) =>
                  previous.map((item) => (item.id === currentRoute.thread.id ? updated : item))
                );
                replaceRoute({ kind: 'thread', thread: updated });
                setDrafts((previous) => ({ ...previous, [currentRoute.thread.id]: '' }));
              });
            }}
          >
            <Text style={styles.primaryWideButtonText}>Send reply</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'thread') return;
              const relatedCard = getCardByName(currentRoute.thread.participant);
              if (relatedCard) {
                openMemberDetail(relatedCard);
              }
            }}
          >
            <Text style={styles.softButtonText}>Open profile</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderBookingPage = () => (
    <View style={styles.pageStack}>
      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        <Text style={styles.surfaceTitle}>
          Book session with {currentRoute?.kind === 'booking' ? currentRoute.card.name : ''}
        </Text>
        <Text style={styles.surfaceHint}>
          Shape the session before you confirm so the exchange starts with clear intent.
        </Text>
        <View style={[styles.slotRow, isPhone && styles.slotRowPhone]}>
          {currentRoute?.kind === 'booking'
            ? currentRoute.card.nextSessionSlots.map((nextSlot) => (
                <Pressable
                  key={nextSlot}
                  style={({ pressed }) => [
                    styles.slotChip,
                    slot === nextSlot && styles.slotChipActive,
                    pressed && styles.pressedScale,
                  ]}
                  onPress={() => setSlot(nextSlot)}
                >
                  <Text
                    style={[
                      styles.slotChipText,
                      slot === nextSlot && styles.slotChipTextActive,
                    ]}
                  >
                    {nextSlot}
                  </Text>
                </Pressable>
              ))
            : null}
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Session format')}
        <View style={styles.bookingFormatRow}>
          {bookingFormats.map((format) => (
            <Pressable
              key={format}
              style={({ pressed }) => [
                styles.bookingChoiceChip,
                bookingFormat === format && styles.bookingChoiceChipActive,
                pressed && styles.pressedScale,
              ]}
              onPress={() => setBookingFormat(format)}
            >
              <Text
                style={[
                  styles.bookingChoiceChipText,
                  bookingFormat === format && styles.bookingChoiceChipTextActive,
                ]}
              >
                {format}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, styles.multilineInput, styles.bookingInputCompact]}
          value={bookingGoal}
          onChangeText={setBookingGoal}
          placeholder="What should this session help you achieve?"
          placeholderTextColor="#7a8a84"
          multiline
        />
        <TextInput
          style={[styles.input, styles.multilineInput, styles.bookingInputCompact]}
          value={bookingNote}
          onChangeText={setBookingNote}
          placeholder="Optional prep note, links, or context to share before the session"
          placeholderTextColor="#7a8a84"
          multiline
        />
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Confirmation preview')}
        <View style={styles.infoStack}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'booking' ? currentRoute.card.name : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Focus</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'booking' ? currentRoute.card.skill : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Slot</Text>
            <Text style={styles.infoValue}>{slot}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Format</Text>
            <Text style={styles.infoValue}>{bookingFormat}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Outcome</Text>
            <Text style={styles.infoValueSoft}>{bookingGoal.trim() || 'Add your session goal'}</Text>
          </View>
          {bookingNote.trim() ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Prep note</Text>
              <Text style={styles.infoValueSoft}>{bookingNote.trim()}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Booking actions')}
        <View style={styles.actionRowPhone}>
          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'booking' || !slot) return;
              const setup: BookingSetup = {
                format: bookingFormat,
                goal: bookingGoal.trim() || getMemberInsight(currentRoute.card).sessionGoal,
                note: bookingNote.trim(),
                slot,
              };
              api
                .bookSession(currentRoute.card.id, slot, {
                  format: bookingFormat,
                  goal: bookingGoal.trim() || getMemberInsight(currentRoute.card).sessionGoal,
                  note: bookingNote.trim(),
                })
                .then((session) => {
                setSessions((previous) => [session, ...previous]);
                pushRoute({ kind: 'booking-confirmed', session, setup });
                setActiveTab('Sessions');
                });
            }}
          >
            <Text style={styles.primaryWideButtonText}>Confirm booking</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={closeDetailPage}
          >
            <Text style={styles.softButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderBookingConfirmedPage = () => (
    <View style={styles.pageStack}>
      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        <Text style={styles.surfaceTitle}>Booking confirmed</Text>
        <Text style={styles.profileHeadline}>
          {currentRoute?.kind === 'booking-confirmed' ? currentRoute.session.skill : ''}
        </Text>
        <Text style={styles.profileBio}>
          {currentRoute?.kind === 'booking-confirmed'
            ? `With ${currentRoute.session.with} · ${currentRoute.session.time}`
            : ''}
        </Text>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('Session summary')}
        <View style={styles.infoStack}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Format</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'booking-confirmed' ? currentRoute.setup.format : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Confirmed slot</Text>
            <Text style={styles.infoValue}>
              {currentRoute?.kind === 'booking-confirmed' ? currentRoute.setup.slot : ''}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Goal</Text>
            <Text style={styles.infoValueSoft}>
              {currentRoute?.kind === 'booking-confirmed' ? currentRoute.setup.goal : ''}
            </Text>
          </View>
          {currentRoute?.kind === 'booking-confirmed' && currentRoute.setup.note ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Prep note</Text>
              <Text style={styles.infoValueSoft}>{currentRoute.setup.note}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
        {renderPhoneSectionTitle('What next')}
        <View style={styles.actionRowPhone}>
          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={() => {
              if (currentRoute?.kind !== 'booking-confirmed') return;
              setNavStack([{ kind: 'session', session: currentRoute.session }]);
            }}
          >
            <Text style={styles.primaryWideButtonText}>Open booking</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
            onPress={() => setNavStack([])}
          >
            <Text style={styles.softButtonText}>Back to app</Text>
          </Pressable>
          {currentRoute?.kind === 'booking-confirmed' ? (
            <Pressable
              style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedScale]}
              onPress={() => {
                const thread = threads.find(
                  (item) =>
                    item.participant === currentRoute.session.with &&
                    item.topic.toLowerCase().includes(currentRoute.session.skill.toLowerCase())
                );
                if (thread) {
                  openThread(thread);
                }
              }}
            >
              <Text style={styles.ghostButtonText}>Open thread</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  const renderActivePage = () => {
    if (currentRoute?.kind === 'member') return renderMemberDetailPage();
    if (currentRoute?.kind === 'session') return renderSessionDetailPage();
    if (currentRoute?.kind === 'event') return renderEventDetailPage();
    if (currentRoute?.kind === 'progress') return renderProgressDetailPage();
    if (currentRoute?.kind === 'inbox') return renderInboxPage();
    if (currentRoute?.kind === 'thread') return renderThreadDetailPage();
    if (currentRoute?.kind === 'booking') return renderBookingPage();
    if (currentRoute?.kind === 'booking-confirmed') return renderBookingConfirmedPage();
    if (activeTab === 'Discover') return renderDashboard();
    if (activeTab === 'Sessions') return renderSessions();
    if (activeTab === 'Community') return renderCommunity();
    if (activeTab === 'Progress') return renderProgress();
    return renderProfile();
  };

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarBrand}>SkillSwap</Text>
      <Text style={styles.sidebarBrandSub}>Private exchange</Text>
      <View style={styles.sidebarNav}>
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            style={({ pressed }) => [
              styles.sidebarItem,
              activeTab === tab && styles.sidebarItemActive,
              pressed && styles.pressedScale,
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.sidebarItemIcon, activeTab === tab && styles.sidebarItemIconActive]}>
              {iconForTab(tab)}
            </Text>
            <Text style={[styles.sidebarItemText, activeTab === tab && styles.sidebarItemTextActive]}>
              {pageMeta[tab].label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.sidebarFooter}>
        <Text style={styles.sidebarFooterTitle}>{user?.name}</Text>
        <Text style={styles.sidebarFooterText}>{user?.headline}</Text>
      </View>
    </View>
  );

  const renderMobileDock = () => (
    <View style={[styles.bottomDock, isPhone ? styles.bottomDockPhoneInline : styles.bottomDockTablet]}>
      {tabs.map((tab) => (
        <Pressable
          key={tab}
          style={({ pressed }) => [
            styles.dockItem,
            isPhone && styles.dockItemPhone,
            activeTab === tab && styles.dockItemActive,
            pressed && styles.pressedScale,
          ]}
          onPress={onNativeAction(() => setActiveTab(tab))}
        >
          <Text
            style={[
              styles.dockText,
              isPhone && styles.dockTextPhone,
              activeTab === tab && styles.dockTextActive,
            ]}
          >
            {mobileTabLabel[tab]}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#d8f2e5" />
          <Text style={styles.loadingText}>Preparing your private exchange space...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token || !user) {
    return renderLanding();
  }

  if (!completeProfile(user)) {
    return renderProfileCompletion();
  }

  const topBarEyebrowText =
    currentRoute?.kind === 'member'
      ? 'MEMBER PAGE'
      : currentRoute?.kind === 'session'
        ? 'BOOKING PAGE'
      : currentRoute?.kind === 'event'
          ? 'ROOM PAGE'
        : currentRoute?.kind === 'progress'
            ? 'GROWTH PLAN'
            : currentRoute?.kind === 'inbox'
              ? 'INBOX'
              : currentRoute?.kind === 'thread'
                ? 'THREAD'
            : currentRoute?.kind === 'booking'
              ? 'BOOK SESSION'
              : currentRoute?.kind === 'booking-confirmed'
                ? 'CONFIRMED'
                : isPhone
                  ? 'PRIVATE EXCHANGE'
                  : pageMeta[activeTab].eyebrow;

  const topBarTitleText =
    currentRoute?.kind === 'member'
      ? currentRoute.card.name
      : currentRoute?.kind === 'session'
        ? currentRoute.session.skill
      : currentRoute?.kind === 'event'
          ? currentRoute.event.title
        : currentRoute?.kind === 'progress'
            ? 'Growth Plan'
            : currentRoute?.kind === 'inbox'
              ? 'Inbox'
              : currentRoute?.kind === 'thread'
                ? currentRoute.thread.participant
            : currentRoute?.kind === 'booking'
              ? currentRoute.card.name
              : currentRoute?.kind === 'booking-confirmed'
                ? 'Booking Confirmed'
                : isPhone
                  ? 'SkillSwap'
                  : pageMeta[activeTab].label;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.appBackground}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />
      </View>

      <View style={[styles.appShell, isWide && styles.appShellWide, isWeb && styles.appShellWeb]}>
        {isWide ? renderSidebar() : null}

        <View style={[styles.mainShell, isWeb && styles.mainShellWeb]}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.shellShine}
          />
          <View style={[styles.topBar, isPhone && styles.topBarPhone, isWeb && styles.topBarWeb]}>
            <View style={isPhone ? styles.topBarCopyPhone : undefined}>
              <Text style={styles.topBarEyebrow}>{topBarEyebrowText}</Text>
              <Text style={[styles.topBarTitle, isPhone && styles.topBarTitlePhone]}>
                {topBarTitleText}
              </Text>
              {isPhone ? (
                <Text style={styles.topBarSupportText}>
                  {showingDetailPage
                    ? 'Focused product view with next actions ready.'
                    : `Network live: ${recommendedCards.length} strong discovery options now.`}
                </Text>
              ) : null}
            </View>
            <View style={[styles.topBarActions, isPhone && styles.topBarActionsPhone]}>
              {showingDetailPage ? (
                <Pressable
                  style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                  onPress={onNativeAction(closeDetailPage)}
                >
                  <Text style={styles.softButtonText}>Back</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                onPress={() => {
                  triggerNativeTap();
                  if (currentRoute?.kind === 'inbox') {
                    return;
                  }
                  if (currentRoute?.kind === 'thread') {
                    popRoute();
                    return;
                  }
                  if (showingDetailPage) {
                    openInbox();
                    return;
                  }
                  api.markMessagesRead().then(setMessages);
                  openInbox();
                }}
              >
                <Text style={styles.softButtonText}>Inbox {messages.unreadCount}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.ghostButtonDark, pressed && styles.pressedScale]}
                onPress={onNativeAction(onLogout)}
              >
                <Text style={styles.ghostButtonDarkText}>Logout</Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#d8f2e5" />
              <Text style={styles.loadingText}>Refreshing the latest sessions, people, and rooms...</Text>
            </View>
          ) : (
            <Animated.ScrollView
              contentContainerStyle={[
                styles.appScroll,
                isPhone && styles.appScrollPhone,
                isWeb && styles.appScrollWeb,
              ]}
              keyboardShouldPersistTaps="handled"
              style={{
                opacity: contentOpacity,
                transform: [{ translateY: contentLift }, { scale: contentScale }],
              }}
            >
              {renderActivePage()}
            </Animated.ScrollView>
          )}

          {!isWide && !showingDetailPage ? renderMobileDock() : null}
        </View>
      </View>

      <Modal
        transparent
        visible={profileModal}
        animationType="slide"
        onRequestClose={() => setProfileModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrap}
            behavior={keyboardBehavior}
            keyboardVerticalOffset={keyboardOffset}
          >
            <ScrollView contentContainerStyle={styles.modalScrollWrap} keyboardShouldPersistTaps="always">
              <View style={styles.modalCard}>
                {renderOnboardingFlow(true)}
                <Pressable
                  style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                  onPress={onNativeAction(() => setProfileModal(false))}
                >
                  <Text style={styles.softButtonText}>Close</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#08120f',
  },
  appBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  glowOne: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: 'rgba(41, 97, 77, 0.32)',
  },
  glowTwo: {
    position: 'absolute',
    right: -120,
    top: 160,
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 154, 85, 0.16)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  flexFill: {
    flex: 1,
  },
  loadingText: {
    color: '#a5c1b6',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 28,
    fontFamily: textFont,
  },
  appShell: {
    flex: 1,
  },
  appShellWeb: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  appShellWide: {
    flexDirection: 'row',
  },
  sidebar: {
    width: 220,
    paddingTop: 28,
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(7, 18, 15, 0.82)',
    gap: 18,
  },
  sidebarBrand: {
    color: '#f4fbf7',
    fontSize: 28,
    fontWeight: '900',
  },
  sidebarBrandSub: {
    color: '#94b7a8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -10,
  },
  sidebarNav: {
    gap: 10,
    marginTop: 12,
  },
  sidebarItem: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 6,
  },
  sidebarItemActive: {
    backgroundColor: '#f0c57c',
  },
  sidebarItemIcon: {
    color: '#aac9bc',
    fontSize: 12,
    fontWeight: '700',
  },
  sidebarItemIconActive: {
    color: '#18211d',
  },
  sidebarItemText: {
    color: '#eff7f3',
    fontSize: 15,
    fontWeight: '800',
  },
  sidebarItemTextActive: {
    color: '#18211d',
  },
  sidebarFooter: {
    marginTop: 'auto',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 4,
  },
  sidebarFooterTitle: {
    color: '#f3faf6',
    fontSize: 14,
    fontWeight: '800',
  },
  sidebarFooterText: {
    color: '#96b7aa',
    fontSize: 12,
    lineHeight: 18,
  },
  mainShell: {
    flex: 1,
  },
  mainShellWeb: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: 'rgba(8, 18, 15, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
  },
  shellShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    opacity: 0.9,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(8, 18, 15, 0.84)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  topBarPhone: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    paddingTop: 12,
    paddingBottom: 8,
  },
  topBarWeb: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topBarCopyPhone: {
    width: '100%',
  },
  topBarEyebrow: {
    color: '#9cbcae',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
    fontFamily: textFont,
  },
  topBarTitle: {
    color: '#f5fbf8',
    fontSize: 28,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  topBarTitlePhone: {
    fontSize: 26,
  },
  topBarSupportText: {
    color: '#95b6a8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontFamily: textFont,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  topBarActionsPhone: {
    width: '100%',
    gap: 8,
  },
  appScroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 18,
  },
  appScrollPhone: {
    paddingHorizontal: 14,
    gap: 14,
    paddingTop: 10,
    paddingBottom: 18,
  },
  appScrollWeb: {
    paddingBottom: 8,
  },
  pageStack: {
    gap: 18,
  },
  phoneListHeader: {
    gap: 4,
    paddingHorizontal: 4,
    paddingTop: 4,
    marginBottom: 2,
  },
  phoneListTitle: {
    color: '#f4fbf7',
    fontSize: 24,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  phoneListHint: {
    color: '#a9c3b7',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: textFont,
  },
  landingScroll: {
    padding: 22,
    gap: 18,
    paddingBottom: 54,
  },
  landingScrollPhone: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 24,
  },
  eyebrow: {
    color: '#b7d5c7',
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '700',
    fontFamily: textFont,
  },
  landingHero: {
    borderRadius: 34,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  landingHeroPhone: {
    borderRadius: 26,
    padding: 18,
  },
  landingHeroInner: {
    gap: 18,
  },
  landingHeroInnerWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  landingCopy: {
    flex: 1.1,
    gap: 14,
  },
  landingCopyPhone: {
    flex: 0,
  },
  landingTitle: {
    color: '#fbfcfb',
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    maxWidth: 660,
    fontFamily: displayFont,
  },
  landingTitlePhone: {
    fontSize: 28,
    lineHeight: 34,
  },
  landingBody: {
    color: '#c7ddd3',
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 620,
    fontFamily: textFont,
  },
  landingActions: {
    gap: 12,
    marginTop: 8,
  },
  heroButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1c57d',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  heroButtonText: {
    color: '#1b221e',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  demoStrip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  demoStripText: {
    color: '#eef7f2',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: textFont,
  },
  landingGlass: {
    flex: 0.9,
    borderRadius: 28,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  landingGlassPhone: {
    flex: 0,
    width: '100%',
  },
  glassTitle: {
    color: '#f4fbf7',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  glassGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  glassGridPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  statCard: {
    flexGrow: 1,
    minWidth: 130,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#183c31',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  statCardPhone: {
    minWidth: 0,
    width: '100%',
    flexGrow: 0,
    flexBasis: 'auto',
    alignSelf: 'stretch',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  statLabel: {
    color: '#d7ebe2',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: textFont,
  },
  statDetail: {
    color: '#acc9bb',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: textFont,
  },
  landingGrid: {
    gap: 18,
  },
  landingGridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  landingMainColumn: {
    flex: 1.2,
    gap: 18,
  },
  landingMainColumnPhone: {
    flex: 0,
  },
  landingSideColumn: {
    flex: 0.8,
    gap: 18,
  },
  landingSideColumnPhone: {
    flex: 0,
  },
  surfaceCard: {
    backgroundColor: '#f7f4ee',
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ded4c4',
    gap: 16,
    shadowColor: '#06100d',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  surfaceCardPhone: {
    padding: 18,
    borderRadius: 26,
  },
  surfaceHeader: {
    gap: 4,
  },
  surfaceTitle: {
    color: '#17211d',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  surfaceHint: {
    color: '#61756d',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: textFont,
  },
  featureList: {
    gap: 14,
  },
  featureItem: {
    gap: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8dfcf',
  },
  featureTitle: {
    color: '#17211d',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  featureText: {
    color: '#63756e',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: textFont,
  },
  authStartPage: {
    flex: 1,
    position: 'relative',
    padding: 24,
    backgroundColor: '#f7f4f1',
  },
  authBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  authPanelWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authPanel: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 34,
    backgroundColor: '#fff',
    paddingVertical: 28,
    paddingHorizontal: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 12,
    gap: 18,
  },
  authPanelPhone: {
    borderRadius: 28,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  authPanelHeader: {
    gap: 10,
  },
  authPanelLabel: {
    color: '#7b5fd8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: displayFont,
  },
  authPanelHeadline: {
    color: '#221934',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 40,
    fontFamily: displayFont,
  },
  authPanelSubhead: {
    color: '#4f4a63',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: textFont,
  },
  authCard: {
    backgroundColor: '#f8f6ff',
    borderRadius: 26,
    padding: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: '#e5dff8',
  },
  authCardTitle: {
    color: '#2e1f56',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 34,
    fontFamily: displayFont,
  },
  authCardText: {
    color: '#6e6480',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: textFont,
  },
  authFormWrap: {
    gap: 14,
    marginTop: 4,
  },
  authInput: {
    backgroundColor: '#fbf8ff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ddd7f1',
    color: '#2a233b',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: textFont,
  },
  authChoiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  authChoiceText: {
    color: '#5a506d',
    fontSize: 14,
    fontFamily: textFont,
  },
  infoCard: {
    backgroundColor: '#ece3d3',
    borderRadius: 28,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#d8cab5',
  },
  infoCardTitle: {
    color: '#17211d',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeChip: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f1ebdf',
    borderWidth: 1,
    borderColor: '#ded3c0',
  },
  modeChipActive: {
    backgroundColor: '#163d31',
    borderColor: '#163d31',
  },
  modeChipText: {
    color: '#5d7068',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  modeChipTextActive: {
    color: '#f7fbf9',
  },
  input: {
    backgroundColor: '#f4efe5',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#ddd4c4',
    color: '#17211d',
    fontSize: 14,
    fontFamily: textFont,
  },
  bookingInputCompact: {
    minHeight: 84,
  },
  multilineInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  primaryWideButton: {
    backgroundColor: '#153d31',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryWideButtonText: {
    color: '#f8fbf9',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  error: {
    color: '#b53d34',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: textFont,
  },
  completionHero: {
    borderRadius: 30,
    padding: 24,
    gap: 12,
  },
  completionTitle: {
    color: '#fbfcfb',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  completionBody: {
    color: '#caded4',
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 640,
    fontFamily: textFont,
  },
  formCard: {
    backgroundColor: '#f7f4ee',
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ddd3c4',
    gap: 14,
  },
  onboardingStepRow: {
    flexDirection: 'row',
    gap: 10,
  },
  onboardingStepPill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  onboardingStepPillActive: {
    backgroundColor: '#f1c57d',
    borderColor: '#f1c57d',
  },
  onboardingStepText: {
    color: '#d1e5dc',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: textFont,
  },
  onboardingStepTextActive: {
    color: '#17211d',
  },
  onboardingChoiceGrid: {
    gap: 10,
  },
  onboardingChoiceCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#ddd3c4',
    backgroundColor: '#f5efe3',
  },
  onboardingChoiceCardActive: {
    backgroundColor: '#173e32',
    borderColor: '#173e32',
  },
  onboardingChoiceTitle: {
    color: '#264b3c',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  onboardingChoiceTitleActive: {
    color: '#f7fbf9',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  heroPanel: {
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroPanelPhone: {
    borderRadius: 26,
    padding: 16,
  },
  heroPanelInner: {
    gap: 16,
  },
  heroPanelInnerWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heroPanelCopy: {
    flex: 1,
    gap: 10,
  },
  pageHeroTitle: {
    color: '#fbfcfb',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    maxWidth: 680,
    fontFamily: displayFont,
  },
  pageHeroTitlePhone: {
    fontSize: 24,
    lineHeight: 30,
  },
  pageHeroBody: {
    color: '#cadfd6',
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 620,
    fontFamily: textFont,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroStatsPhone: {
    flexDirection: 'column',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  quickActionRowPhone: {
    flexDirection: 'column',
  },
  quickAction: {
    flexGrow: 1,
    minWidth: 180,
    backgroundColor: '#10231d',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  quickActionPhone: {
    minWidth: 0,
    width: '100%',
    padding: 14,
    flexGrow: 0,
    flexBasis: 'auto',
  },
  quickActionLabel: {
    color: '#9cbcae',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: textFont,
  },
  quickActionValue: {
    color: '#f5fbf8',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  compactSummaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  compactMetric: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f1ebdf',
    borderWidth: 1,
    borderColor: '#e2d6c3',
    gap: 3,
  },
  compactMetricValue: {
    color: '#173a2e',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  compactMetricLabel: {
    color: '#5e716a',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: textFont,
  },
  contentColumns: {
    gap: 18,
  },
  contentColumnsWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  primaryColumn: {
    flex: 1.2,
    gap: 18,
  },
  primaryColumnPhone: {
    flex: 0,
  },
  secondaryColumn: {
    flex: 0.8,
    gap: 18,
  },
  secondaryColumnPhone: {
    flex: 0,
  },
  memberGrid: {
    gap: 14,
  },
  memberGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  memberCard: {
    flexGrow: 1,
    flexBasis: 300,
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e7ddce',
    gap: 10,
  },
  memberCardPhone: {
    flexBasis: '100%',
    padding: 16,
    flexGrow: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  memberCardCompact: {
    flexBasis: 240,
  },
  mobileMemberCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e7ddce',
    gap: 12,
  },
  memberBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#eef3ed',
  },
  memberBadgeText: {
    color: '#325445',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    fontFamily: textFont,
  },
  memberRating: {
    color: '#204d3b',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: textFont,
  },
  memberName: {
    color: '#17211d',
    fontSize: 20,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  memberMeta: {
    color: '#61756d',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: textFont,
  },
  trustBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  microBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f1eadc',
    borderWidth: 1,
    borderColor: '#ded2bf',
  },
  microBadgeText: {
    color: '#355648',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: textFont,
  },
  memberSkill: {
    color: '#1f4f3d',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  memberBio: {
    color: '#61756d',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: textFont,
  },
  memberSignal: {
    color: '#284c3d',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: textFont,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  rowBetweenPhone: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  slotRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  mobileSlotRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  slotRowPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  slotChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#edf1ea',
    borderWidth: 1,
    borderColor: '#dbe2d9',
  },
  mobileSlotChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#edf1ea',
    borderWidth: 1,
    borderColor: '#dbe2d9',
  },
  slotChipActive: {
    backgroundColor: '#163d31',
    borderColor: '#163d31',
  },
  slotChipText: {
    color: '#365246',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: textFont,
  },
  slotChipTextActive: {
    color: '#f6fbf8',
  },
  bookingFormatRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  bookingChoiceChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#f1ebdf',
    borderWidth: 1,
    borderColor: '#ddd2bf',
  },
  bookingChoiceChipActive: {
    backgroundColor: '#173e32',
    borderColor: '#173e32',
  },
  bookingChoiceChipText: {
    color: '#5e716a',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: textFont,
  },
  bookingChoiceChipTextActive: {
    color: '#f7fbf9',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  actionRowPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  mobileActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: '#153d31',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mobilePrimaryButton: {
    backgroundColor: '#153d31',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  mobileSecondaryButton: {
    backgroundColor: '#ece6d8',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd2be',
  },
  mobileOutlineButton: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2d5043',
    backgroundColor: '#fffdf8',
  },
  primaryButtonText: {
    color: '#f7fbf9',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  softButton: {
    backgroundColor: '#ece6d8',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd2be',
  },
  softButtonText: {
    color: '#355047',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  ghostButton: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2d5043',
    backgroundColor: '#f7f4ee',
  },
  ghostButtonText: {
    color: '#2d5043',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  ghostButtonDark: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ghostButtonDarkText: {
    color: '#eff7f2',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  modeFilterChip: {
    borderRadius: 999,
    backgroundColor: '#143126',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeFilterChipActive: {
    backgroundColor: '#f1c57d',
    borderColor: '#f1c57d',
  },
  modeFilterChipText: {
    color: '#e5f2eb',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  modeFilterChipTextActive: {
    color: '#17211d',
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: '#f0ebdf',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#dfd4bf',
  },
  filterChipActive: {
    backgroundColor: '#163d31',
    borderColor: '#163d31',
  },
  filterChipText: {
    color: '#556861',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: textFont,
  },
  filterChipTextActive: {
    color: '#f7fbf9',
  },
  darkCard: {
    backgroundColor: '#11231d',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  darkCardPhone: {
    borderRadius: 24,
    padding: 16,
  },
  darkCardTitle: {
    color: '#f2faf6',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  darkCardText: {
    color: '#b8d1c6',
    fontSize: 13,
    lineHeight: 21,
    fontFamily: textFont,
  },
  mixBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mixMentor: {
    backgroundColor: '#5aad88',
  },
  mixLearner: {
    backgroundColor: '#d4a562',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e7dece',
  },
  listRowBody: {
    flex: 1,
    gap: 4,
  },
  listRowTitle: {
    color: '#17211d',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  listRowText: {
    color: '#61756d',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: textFont,
  },
  listRowMeta: {
    color: '#2f5245',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: textFont,
  },
  stackCard: {
    gap: 4,
    paddingVertical: 8,
    borderRadius: 18,
    paddingHorizontal: 12,
    backgroundColor: '#fbf8f1',
    borderWidth: 1,
    borderColor: '#e7ddce',
    shadowColor: '#08120e',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  stackCardTitle: {
    color: '#17211d',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  stackCardText: {
    color: '#62756e',
    fontSize: 12,
    fontFamily: textFont,
  },
  emptyText: {
    color: '#677972',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: textFont,
  },
  sectionHero: {
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  sectionHeroPhone: {
    borderRadius: 24,
    padding: 16,
    gap: 8,
  },
  sectionHeroTitle: {
    color: '#fbfcfb',
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    maxWidth: 700,
    fontFamily: displayFont,
  },
  sectionHeroTitlePhone: {
    fontSize: 22,
    lineHeight: 28,
  },
  sectionHeroText: {
    color: '#cbddd4',
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 640,
    fontFamily: textFont,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  summaryRowPhone: {
    flexDirection: 'column',
  },
  sessionCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e6dccd',
    gap: 14,
  },
  sessionCardPhone: {
    padding: 16,
  },
  sessionTitle: {
    color: '#17211d',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  sessionMeta: {
    color: '#61756d',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: textFont,
  },
  sessionStatus: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sessionStatusUpcoming: {
    backgroundColor: '#507466',
  },
  sessionStatusLive: {
    backgroundColor: '#0f8a5f',
  },
  sessionStatusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    fontFamily: textFont,
  },
  eventCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e6dccd',
    gap: 12,
  },
  eventCardPhone: {
    padding: 16,
  },
  eventCopy: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    color: '#17211d',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  eventText: {
    color: '#62756e',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: textFont,
  },
  eventMeta: {
    color: '#204d3b',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  notificationItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  notificationDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#234d3f',
    marginTop: 6,
  },
  notificationBody: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    color: '#17211d',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  notificationText: {
    color: '#62756e',
    fontSize: 12,
    lineHeight: 19,
    fontFamily: textFont,
  },
  threadCard: {
    backgroundColor: '#fffdf8',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e6dccd',
    gap: 10,
  },
  threadCardPhone: {
    padding: 14,
  },
  threadName: {
    color: '#17211d',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  threadUnread: {
    color: '#335749',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: textFont,
  },
  threadTopic: {
    color: '#50645d',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: textFont,
  },
  threadText: {
    color: '#62756e',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: textFont,
  },
  roadmapTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#e8e1d4',
    overflow: 'hidden',
    marginBottom: 8,
  },
  roadmapFill: {
    height: '100%',
    backgroundColor: '#163d31',
  },
  roadmapItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8dfcf',
  },
  roadmapTitle: {
    color: '#17211d',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: displayFont,
  },
  roadmapState: {
    color: '#315445',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: textFont,
  },
  profileHeadline: {
    color: '#214c3a',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  profileSubline: {
    color: '#61756d',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: textFont,
  },
  profileBio: {
    color: '#5f736b',
    fontSize: 14,
    lineHeight: 23,
    fontFamily: textFont,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#fff9ee',
    borderWidth: 1,
    borderColor: '#ddd2bf',
  },
  tagText: {
    color: '#3b564c',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: textFont,
  },
  bottomDock: {
    backgroundColor: 'rgba(9, 20, 16, 0.94)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bottomDockTablet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  bottomDockPhoneInline: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  dockItem: {
    flex: 1,
    borderRadius: 16,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockItemPhone: {
    minHeight: 50,
    borderRadius: 14,
    paddingVertical: 6,
  },
  dockItemActive: {
    backgroundColor: '#f1c57d',
  },
  dockText: {
    color: '#edf7f2',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: textFont,
  },
  dockTextPhone: {
    fontSize: 10,
    lineHeight: 12,
  },
  dockTextActive: {
    color: '#17211d',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
    backgroundColor: 'rgba(6, 11, 9, 0.5)',
  },
  modalKeyboardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrollWrap: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#f7f4ee',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ddd3c4',
    gap: 14,
  },
  infoStack: {
    gap: 10,
  },
  infoRow: {
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e8dfcf',
  },
  infoLabel: {
    color: '#5f726b',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: textFont,
  },
  infoValue: {
    color: '#17211d',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: displayFont,
  },
  infoValueSoft: {
    color: '#5f736b',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: textFont,
  },
  premiumNoteCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#183c31',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  premiumNoteTitle: {
    color: '#f7fbf9',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: displayFont,
  },
  premiumNoteBody: {
    color: '#cfe2da',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: textFont,
  },
  quoteCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#fff9ef',
    borderWidth: 1,
    borderColor: '#e2d6c4',
    gap: 8,
  },
  quoteLabel: {
    color: '#5d7068',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: textFont,
  },
  quoteText: {
    color: '#17211d',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
    fontFamily: textFont,
  },
  pressedScale: {
    transform: [{ scale: 0.985 }],
  },
});
