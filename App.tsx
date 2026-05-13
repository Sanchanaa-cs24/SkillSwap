import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { api, getAuthToken, setAuthToken } from './src/api';
import type {
  AppNotification,
  AuthResponse,
  CommunityEvent,
  DiscoveryCard,
  LearningPlan,
  MessageThread,
  Messages,
  PublicOverview,
  Session,
  Tab,
  User,
} from './src/types';

const tabs: Tab[] = ['Discover', 'Sessions', 'Community', 'Progress', 'Profile'];
const personas = ['All', 'teacher', 'learner'] as const;
const TOKEN_KEY = 'skillsswap_token';
const palette = {
  bg: '#050505',
  bgSoft: '#0b0b0b',
  surface: '#101010',
  surfaceMuted: '#141414',
  surfaceAlt: '#1a1a1a',
  line: '#272727',
  lineStrong: '#3a3a3a',
  text: '#f7f7f7',
  textMuted: '#b4b4b4',
  textSoft: '#7e7e7e',
  accent: '#f3f3f3',
  accentSoft: '#1f1f1f',
  accentStrong: '#ffffff',
  accentAlt: '#171717',
  shadow: 'rgba(0, 0, 0, 0.42)',
};

const local = (globalThis as { localStorage?: Storage }).localStorage;
const readStoredToken = () => local?.getItem(TOKEN_KEY) ?? '';
const storeToken = (token: string) => local?.setItem(TOKEN_KEY, token);
const clearToken = () => local?.removeItem(TOKEN_KEY);
const supportsNativeAnimatedDriver = Platform.OS !== 'web';
const PRODUCTION_API_BASE = 'https://skills-swap-kappa.vercel.app/api';
const configuredApiBase =
  process.env.EXPO_PUBLIC_API_BASE || PRODUCTION_API_BASE;
const isWeb = Platform.OS === 'web';
const calendarBaseUrl =
  isWeb
    ? window.location.origin
    : configuredApiBase.replace(/\/api$/, '') || 'https://skills-swap-kappa.vercel.app';

const completeProfile = (user: User | null) =>
  Boolean(
    user &&
      user.headline &&
      user.bio &&
      user.country &&
      user.skillsOffered.length &&
      user.skillsToLearn.length
  );

const pageMeta: Record<Tab, { label: string; eyebrow: string }> = {
  Discover: { label: 'Home', eyebrow: 'Overview' },
  Sessions: { label: 'Sessions', eyebrow: 'Schedule' },
  Community: { label: 'Community', eyebrow: 'Connections' },
  Progress: { label: 'Progress', eyebrow: 'Growth' },
  Profile: { label: 'Profile', eyebrow: 'Your space' },
};

const mobileTabLabel: Record<Tab, string> = {
  Discover: 'Home',
  Sessions: 'Sessions',
  Community: 'Community',
  Progress: 'Progress',
  Profile: 'Profile',
};

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

export default function App() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1180;
  const isTablet = width >= 900;
  const isPhone = width < 640;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentLift = useRef(new Animated.Value(0)).current;

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Discover');
  const [error, setError] = useState('');
  const [publicOverview, setPublicOverview] = useState<PublicOverview | null>(null);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('demo@skillsswap.app');
  const [authPassword, setAuthPassword] = useState('demo123');

  const [profileName, setProfileName] = useState('');
  const [profileHeadline, setProfileHeadline] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileCountry, setProfileCountry] = useState('');
  const [profileOffered, setProfileOffered] = useState('');
  const [profileLearn, setProfileLearn] = useState('');
  const [profileModal, setProfileModal] = useState(false);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [persona, setPersona] = useState<(typeof personas)[number]>('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [cards, setCards] = useState<DiscoveryCard[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [messages, setMessages] = useState<Messages>({ unreadCount: 0 });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [bookingCard, setBookingCard] = useState<DiscoveryCard | null>(null);
  const [slot, setSlot] = useState('');

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
    () => sessions.filter((session) => session.status === 'upcoming'),
    [sessions]
  );
  const liveSessions = useMemo(
    () => sessions.filter((session) => session.status === 'live'),
    [sessions]
  );
  const completedSessions = useMemo(
    () => sessions.filter((session) => session.status === 'completed'),
    [sessions]
  );
  const savedCards = useMemo(
    () => cards.filter((card) => card.favorited),
    [cards]
  );
  const connectedCards = useMemo(
    () => cards.filter((card) => card.connected),
    [cards]
  );
  const recommendedCards = useMemo(
    () => cards.slice(0, isWide ? 6 : isPhone ? 3 : 4),
    [cards, isPhone, isWide]
  );
  const phoneRecommendedCards = useMemo(
    () => cards.slice(0, 6),
    [cards]
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  useEffect(() => {
    contentOpacity.setValue(0.34);
    contentLift.setValue(16);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: supportsNativeAnimatedDriver,
      }),
      Animated.timing(contentLift, {
        toValue: 0,
        duration: 240,
        useNativeDriver: supportsNativeAnimatedDriver,
      }),
    ]).start();
  }, [activeTab, contentLift, contentOpacity]);

  const hydrateUser = (next: User) => {
    setUser(next);
    setProfileName(next.name);
    setProfileHeadline(next.headline);
    setProfileBio(next.bio);
    setProfileCountry(next.country);
    setProfileOffered(next.skillsOffered.join(', '));
    setProfileLearn(next.skillsToLearn.join(', '));
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
    setDrafts({});
    setBookingCard(null);
    setSlot('');
  };

  const loadPublicOverview = async () => {
    try {
      const overview = await api.publicOverview();
      setPublicOverview(overview);
    } catch {
      setPublicOverview(null);
    }
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
    ] = await Promise.all([
      api.categories(),
      api.discovery(query, category, persona),
      api.sessions(),
      api.events(),
      api.learningPlan(),
      api.messages(),
      api.notifications(),
      api.messageThreads(),
    ]);

    setCategories(['All', ...nextCategories]);
    setCards(nextCards);
    setSessions(nextSessions);
    setEvents(nextEvents);
    setPlan(nextPlan);
    setMessages(nextMessages);
    setNotifications(nextNotifications);
    setThreads(nextThreads);
  };

  useEffect(() => {
    void loadPublicOverview();
  }, []);

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
      void Promise.all([api.messages(), api.notifications(), api.messageThreads()]).then(
        ([nextMessages, nextNotifications, nextThreads]) => {
          setMessages(nextMessages);
          setNotifications(nextNotifications);
          setThreads(nextThreads);
        }
      );
    }, 10000);

    return () => clearInterval(timer);
  }, [token, user]);

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

  const saveProfile = async () => {
    if (!user) return;
    const offered = profileOffered
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const learn = profileLearn
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const updated = await api.saveProfile({
      name: profileName.trim(),
      headline: profileHeadline.trim(),
      bio: profileBio.trim(),
      country: profileCountry.trim(),
      skillsOffered: offered,
      skillsToLearn: learn,
    });

    hydrateUser(updated);
    await loadAll();
    setProfileModal(false);
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

  const updateCard = (id: string, nextCard: DiscoveryCard) => {
    setCards((previous) => previous.map((item) => (item.id === id ? nextCard : item)));
  };

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
        {card.title} / {card.country}
      </Text>
      <Text style={styles.memberSkill}>{card.skill}</Text>
      <Text style={styles.memberBio}>{card.bio}</Text>
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
              setBookingCard(card);
              setSlot(card.nextSessionSlots[0] ?? '');
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
        {card.title} / {card.country}
      </Text>
      <Text style={styles.memberSkill}>{card.skill}</Text>
      <Text style={styles.memberBio}>{card.bio}</Text>
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
              setBookingCard(card);
              setSlot(card.nextSessionSlots[0] ?? '');
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
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.landingScroll, isPhone && styles.landingScrollPhone]}>
        <View style={[styles.authScreen, isWide && styles.authScreenWide]}>
          <View style={styles.authHeader}>
            <Text style={styles.brandBarTitle}>SkillSwap</Text>
            <Text style={styles.authHeaderText}>Sign in or create an account to continue.</Text>
          </View>

          <View style={[styles.loginCard, styles.authCardCompact, isPhone && styles.loginCardPhone]}>
            <View style={styles.toggleRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.modeChip,
                  authMode === 'login' && styles.modeChipActive,
                  pressed && styles.pressedScale,
                ]}
                onPress={() => setAuthMode('login')}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    authMode === 'login' && styles.modeChipTextActive,
                  ]}
                >
                  Login
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modeChip,
                  authMode === 'register' && styles.modeChipActive,
                  pressed && styles.pressedScale,
                ]}
                onPress={() => setAuthMode('register')}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    authMode === 'register' && styles.modeChipTextActive,
                  ]}
                >
                  Register
                </Text>
              </Pressable>
            </View>
            {authMode === 'register' ? (
              <TextInput
                style={styles.input}
                value={authName}
                onChangeText={setAuthName}
                placeholder="Name"
                placeholderTextColor={palette.textSoft}
              />
            ) : null}
            <TextInput
              style={styles.input}
              value={authEmail}
              onChangeText={setAuthEmail}
              placeholder="Email"
              placeholderTextColor={palette.textSoft}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={authPassword}
              onChangeText={setAuthPassword}
              placeholder="Password"
              placeholderTextColor={palette.textSoft}
              secureTextEntry
            />
            <Pressable
              style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
              onPress={onAuth}
            >
              <Text style={styles.primaryWideButtonText}>
                {authMode === 'register' ? 'Create account' : 'Continue'}
              </Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const renderProfileCompletion = () => (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.landingScroll}>
        <LinearGradient colors={['#050505', '#101010']} style={styles.completionHero}>
          <Text style={styles.eyebrow}>MEMBER SETUP</Text>
          <Text style={styles.completionTitle}>Complete your profile to unlock better matches.</Text>
          <Text style={styles.completionBody}>
            A few details make discovery, booking, and recommendations feel much more useful.
          </Text>
        </LinearGradient>

        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            value={profileName}
            onChangeText={setProfileName}
            placeholder="Name"
            placeholderTextColor={palette.textSoft}
          />
          <TextInput
            style={styles.input}
            value={profileHeadline}
            onChangeText={setProfileHeadline}
            placeholder="Headline"
            placeholderTextColor={palette.textSoft}
          />
          <TextInput
            style={styles.input}
            value={profileCountry}
            onChangeText={setProfileCountry}
            placeholder="Country"
            placeholderTextColor={palette.textSoft}
          />
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={profileBio}
            onChangeText={setProfileBio}
            placeholder="Describe what you do and how you help"
            placeholderTextColor={palette.textSoft}
            multiline
          />
          <TextInput
            style={styles.input}
            value={profileOffered}
            onChangeText={setProfileOffered}
            placeholder="Skills you offer"
            placeholderTextColor={palette.textSoft}
          />
          <TextInput
            style={styles.input}
            value={profileLearn}
            onChangeText={setProfileLearn}
            placeholder="Skills you want to learn"
            placeholderTextColor={palette.textSoft}
          />
          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={saveProfile}
          >
            <Text style={styles.primaryWideButtonText}>Save profile</Text>
          </Pressable>
        </View>
      </ScrollView>
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

  const renderDashboard = () => (
    isPhone ? (
      <View style={styles.pageStack}>
        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Today', 'Your key actions in one view')}
          <View style={[styles.summaryRow, styles.summaryRowPhone]}>
            {renderStatCard(String(recommendedCards.length), 'Matches', 'Recommended now')}
            {renderStatCard(String(savedCards.length), 'Saved', 'Profiles in shortlist')}
          </View>
        </View>

        {renderQuickActions()}

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Discover', 'Search, filter, and book')}
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search mentors, explorers, or skills"
            placeholderTextColor={palette.textSoft}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
          </ScrollView>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Recommended', `${cards.length} profiles match your filters`)}
        </View>

        {phoneRecommendedCards.map((card) => renderMobileMemberCard(card))}

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
          {renderPhoneSectionTitle('Community picks', 'Live events worth joining')}
          {events.slice(0, 4).map((event) => (
            <View key={event.id} style={styles.stackCard}>
              <Text style={styles.stackCardTitle}>{event.title}</Text>
              <Text style={styles.stackCardText}>{event.participants} attending</Text>
            </View>
          ))}
        </View>
      </View>
    ) : (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['#050505', '#101010', '#191919']}
        style={[styles.heroPanel, isPhone && styles.heroPanelPhone]}
      >
        <View style={[styles.heroPanelInner, isWide && styles.heroPanelInnerWide]}>
          <View style={styles.heroPanelCopy}>
            <Text style={styles.eyebrow}>{pageMeta.Discover.eyebrow}</Text>
            <Text style={[styles.pageHeroTitle, isPhone && styles.pageHeroTitlePhone]}>
              Welcome back, {user?.name.split(' ')[0]}.
            </Text>
            <Text style={styles.pageHeroBody}>
              Today keeps your best matches, next sessions, and progress in one place.
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
              <Text style={styles.surfaceTitle}>Discover people</Text>
              <Text style={styles.surfaceHint}>Search and filter the live network</Text>
            </View>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search mentors, explorers, or skills"
              placeholderTextColor={palette.textSoft}
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
              <Text style={styles.surfaceHint}>{cards.length} live profiles match your filters</Text>
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
          {renderPhoneSectionTitle('Session pipeline', 'Move from booked to live to completed')}
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
                    With {session.with} / {session.time}
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
                  style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                  onPress={() =>
                    api.updateSessionStatus(session.id, 'upcoming').then((updated) =>
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
                    api.updateSessionStatus(session.id, 'live').then((updated) =>
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
                    api.updateSessionStatus(session.id, 'completed').then((updated) =>
                      setSessions((previous) =>
                        previous.map((item) => (item.id === session.id ? updated : item))
                      )
                    )
                  }
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
      </View>
    ) : (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['#050505', '#101010']}
        style={[styles.sectionHero, isPhone && styles.sectionHeroPhone]}
      >
        <View style={[styles.sectionHeroInner, isWide && styles.sectionHeroInnerWide]}>
          <View style={styles.sectionHeroCopy}>
            <Text style={styles.eyebrow}>{pageMeta.Sessions.eyebrow}</Text>
            <Text style={[styles.sectionHeroTitle, isPhone && styles.sectionHeroTitlePhone]}>
              Keep every booked session in one clear flow.
            </Text>
            <Text style={styles.sectionHeroText}>
              Move from upcoming to live to complete without losing context.
            </Text>
          </View>
        </View>
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
                      With {session.with} / {session.time}
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
          {events.map((event) => (
            <View key={event.id} style={[styles.eventCard, styles.eventCardPhone]}>
              <View style={[styles.rowBetween, styles.rowBetweenPhone]}>
                <View style={styles.eventCopy}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventText}>{event.description}</Text>
                </View>
                <Text style={styles.eventMeta}>{event.participants}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedScale]}
                onPress={() =>
                  api.joinEvent(event.id).then((updated) =>
                    setEvents((previous) =>
                      previous.map((item) => (item.id === event.id ? updated : item))
                    )
                  )
                }
              >
                <Text style={styles.primaryButtonText}>{event.joined ? 'Joined' : 'Join room'}</Text>
              </Pressable>
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
          {renderPhoneSectionTitle('Message threads')}
          {threads.map((thread) => (
            <View key={thread.id} style={[styles.threadCard, styles.threadCardPhone]}>
              <View style={[styles.rowBetween, styles.rowBetweenPhone]}>
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
                placeholderTextColor={palette.textSoft}
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
    ) : (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['#050505', '#101010']}
        style={[styles.sectionHero, isPhone && styles.sectionHeroPhone]}
      >
        <View style={[styles.sectionHeroInner, isWide && styles.sectionHeroInnerWide]}>
          <View style={styles.sectionHeroCopy}>
            <Text style={styles.eyebrow}>{pageMeta.Community.eyebrow}</Text>
            <Text style={[styles.sectionHeroTitle, isPhone && styles.sectionHeroTitlePhone]}>
              Keep events, inbox, and updates in one lightweight space.
            </Text>
            <Text style={styles.sectionHeroText}>
              Join rooms, reply quickly, and stay on top of activity.
            </Text>
          </View>
        </View>
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
                  placeholderTextColor={palette.textSoft}
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
        colors={['#050505', '#101010']}
        style={[styles.sectionHero, isPhone && styles.sectionHeroPhone]}
      >
        <View style={[styles.sectionHeroInner, isWide && styles.sectionHeroInnerWide]}>
          <View style={styles.sectionHeroCopy}>
            <Text style={styles.eyebrow}>{pageMeta.Progress.eyebrow}</Text>
            <Text style={[styles.sectionHeroTitle, isPhone && styles.sectionHeroTitlePhone]}>
              Keep momentum visible without clutter.
            </Text>
            <Text style={styles.sectionHeroText}>
              Track setup, sessions, and participation in a simple progress view.
            </Text>
          </View>
        </View>
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
            {user?.country} / {user?.email}
          </Text>
          <Text style={styles.profileBio}>{user?.bio}</Text>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Skills offered')}
          <View style={styles.tagWrap}>
            {user?.skillsOffered.map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.surfaceCard, styles.surfaceCardPhone]}>
          {renderPhoneSectionTitle('Learning next')}
          <View style={styles.tagWrap}>
            {user?.skillsToLearn.map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
          onPress={() => setProfileModal(true)}
        >
          <Text style={styles.primaryWideButtonText}>Edit profile</Text>
        </Pressable>
      </View>
    ) : (
    <View style={styles.pageStack}>
      <LinearGradient
        colors={['#050505', '#101010']}
        style={[styles.sectionHero, isPhone && styles.sectionHeroPhone]}
      >
        <View style={[styles.sectionHeroInner, isWide && styles.sectionHeroInnerWide]}>
          <View style={styles.sectionHeroCopy}>
            <Text style={styles.eyebrow}>{pageMeta.Profile.eyebrow}</Text>
            <Text style={[styles.sectionHeroTitle, isPhone && styles.sectionHeroTitlePhone]}>
              Keep your profile polished and easy to scan.
            </Text>
            <Text style={styles.sectionHeroText}>
              Your skills, goals, and details stay neatly organized here.
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.contentColumns, isWide && styles.contentColumnsWide]}>
        <View style={[styles.primaryColumn, isPhone && styles.primaryColumnPhone]}>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>{user?.name}</Text>
            <Text style={styles.profileHeadline}>{user?.headline}</Text>
            <Text style={styles.profileSubline}>
              {user?.country} / {user?.email}
            </Text>
            <Text style={styles.profileBio}>{user?.bio}</Text>
          </View>
        </View>

        <View style={[styles.secondaryColumn, isPhone && styles.secondaryColumnPhone]}>
          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Skills offered</Text>
            <View style={styles.tagWrap}>
              {user?.skillsOffered.map((item) => (
                <View key={item} style={styles.tag}>
                  <Text style={styles.tagText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.surfaceCard, isPhone && styles.surfaceCardPhone]}>
            <Text style={styles.surfaceTitle}>Learning next</Text>
            <View style={styles.tagWrap}>
              {user?.skillsToLearn.map((item) => (
                <View key={item} style={styles.tag}>
                  <Text style={styles.tagText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryWideButton, pressed && styles.pressedScale]}
            onPress={() => setProfileModal(true)}
          >
            <Text style={styles.primaryWideButtonText}>Edit profile</Text>
          </Pressable>
        </View>
      </View>
    </View>
    )
  );

  const renderActivePage = () => {
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
          onPress={() => setActiveTab(tab)}
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
          <ActivityIndicator size="large" color={palette.accentStrong} />
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.appBackground}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />
      </View>

      <View style={[styles.appShell, isWide && styles.appShellWide]}>
        {isWide ? renderSidebar() : null}

        <View style={styles.mainShell}>
          <View style={[styles.topBar, isPhone && styles.topBarPhone]}>
            <View style={isPhone ? styles.topBarCopyPhone : undefined}>
              <Text style={styles.topBarEyebrow}>{pageMeta[activeTab].eyebrow}</Text>
              <Text style={[styles.topBarTitle, isPhone && styles.topBarTitlePhone]}>
                {pageMeta[activeTab].label}
              </Text>
            </View>
            <View style={[styles.topBarActions, isPhone && styles.topBarActionsPhone]}>
              <Pressable
                style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                onPress={() => api.markMessagesRead().then(setMessages)}
              >
                <Text style={styles.softButtonText}>Inbox {messages.unreadCount}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.ghostButtonDark, pressed && styles.pressedScale]}
                onPress={onLogout}
              >
                <Text style={styles.ghostButtonDarkText}>Logout</Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={palette.accentStrong} />
            </View>
          ) : (
            <Animated.ScrollView
              contentContainerStyle={[styles.appScroll, isPhone && styles.appScrollPhone]}
              style={{ opacity: contentOpacity, transform: [{ translateY: contentLift }] }}
            >
              {renderActivePage()}
            </Animated.ScrollView>
          )}

          {!isWide ? renderMobileDock() : null}
        </View>
      </View>

      <Modal
        transparent
        visible={Boolean(bookingCard)}
        animationType="slide"
        onRequestClose={() => setBookingCard(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.surfaceTitle}>Book session with {bookingCard?.name}</Text>
            <Text style={styles.surfaceHint}>Choose the next available slot</Text>
            <View style={[styles.slotRow, isPhone && styles.slotRowPhone]}>
              {bookingCard?.nextSessionSlots.map((nextSlot) => (
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
              ))}
            </View>
            <View style={[styles.actionRow, isPhone && styles.actionRowPhone]}>
              <Pressable
                style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                onPress={() => setBookingCard(null)}
              >
                <Text style={styles.softButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedScale]}
                onPress={() => {
                  if (!bookingCard || !slot) return;
                  api.bookSession(bookingCard.id, slot).then((session) => {
                    setSessions((previous) => [session, ...previous]);
                    setBookingCard(null);
                    setActiveTab('Sessions');
                  });
                }}
              >
                <Text style={styles.primaryButtonText}>Confirm booking</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={profileModal}
        animationType="slide"
        onRequestClose={() => setProfileModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.surfaceTitle}>Edit profile</Text>
            <TextInput
              style={styles.input}
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Name"
              placeholderTextColor={palette.textSoft}
            />
            <TextInput
              style={styles.input}
              value={profileHeadline}
              onChangeText={setProfileHeadline}
              placeholder="Headline"
              placeholderTextColor={palette.textSoft}
            />
            <TextInput
              style={styles.input}
              value={profileCountry}
              onChangeText={setProfileCountry}
              placeholder="Country"
              placeholderTextColor={palette.textSoft}
            />
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={profileBio}
              onChangeText={setProfileBio}
              placeholder="Bio"
              placeholderTextColor={palette.textSoft}
              multiline
            />
            <TextInput
              style={styles.input}
              value={profileOffered}
              onChangeText={setProfileOffered}
              placeholder="Skills offered"
              placeholderTextColor={palette.textSoft}
            />
            <TextInput
              style={styles.input}
              value={profileLearn}
              onChangeText={setProfileLearn}
              placeholder="Skills to learn"
              placeholderTextColor={palette.textSoft}
            />
            <View style={[styles.actionRow, isPhone && styles.actionRowPhone]}>
              <Pressable
                style={({ pressed }) => [styles.softButton, pressed && styles.pressedScale]}
                onPress={() => setProfileModal(false)}
              >
                <Text style={styles.softButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedScale]}
                onPress={saveProfile}
              >
                <Text style={styles.primaryButtonText}>Save changes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  appBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.bg,
  },
  glowOne: {
    position: 'absolute',
    top: -80,
    left: -40,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  glowTwo: {
    position: 'absolute',
    right: -60,
    top: 120,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appShell: {
    flex: 1,
  },
  appShellWide: {
    flexDirection: 'row',
  },
  sidebar: {
    width: 220,
    paddingTop: 24,
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderRightWidth: 1,
    borderRightColor: palette.line,
    backgroundColor: 'rgba(8, 8, 8, 0.9)',
    gap: 18,
  },
  sidebarBrand: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
  },
  sidebarBrandSub: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -6,
  },
  sidebarNav: {
    gap: 10,
    marginTop: 12,
  },
  sidebarItem: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 4,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  sidebarItemActive: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.lineStrong,
  },
  sidebarItemIcon: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  sidebarItemIconActive: {
    color: palette.accentStrong,
  },
  sidebarItemText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sidebarItemTextActive: {
    color: palette.accentStrong,
  },
  sidebarFooter: {
    marginTop: 'auto',
    padding: 14,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 4,
  },
  sidebarFooterTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sidebarFooterText: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  mainShell: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  topBarPhone: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    paddingTop: 12,
    paddingBottom: 8,
  },
  topBarCopyPhone: {
    width: '100%',
  },
  topBarEyebrow: {
    color: palette.textSoft,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  topBarTitle: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  topBarTitlePhone: {
    fontSize: 24,
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
    paddingBottom: 28,
    gap: 20,
  },
  appScrollPhone: {
    paddingHorizontal: 16,
    gap: 16,
    paddingTop: 8,
    paddingBottom: 22,
  },
  pageStack: {
    gap: 20,
  },
  landingScroll: {
    padding: 22,
    gap: 20,
    paddingBottom: 54,
  },
  landingScrollPhone: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 24,
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  landingHero: {
    borderRadius: 32,
    padding: 28,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 3,
  },
  landingHeroPhone: {
    borderRadius: 26,
    padding: 18,
  },
  landingHeroInner: {
    gap: 18,
  },
  landingHeroInnerPhone: {
    alignItems: 'stretch',
  },
  landingHeroInnerWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  landingHeroAside: {
    flex: 0.95,
    gap: 16,
  },
  landingHeroAsidePhone: {
    flex: 0,
  },
  landingCopy: {
    flex: 1.1,
    gap: 14,
  },
  landingCopyPhone: {
    flex: 0,
  },
  landingTitle: {
    color: palette.text,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1.3,
    maxWidth: 660,
  },
  landingTitlePhone: {
    fontSize: 28,
    lineHeight: 34,
  },
  landingBody: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 25,
    maxWidth: 580,
  },
  landingActions: {
    gap: 12,
    marginTop: 8,
  },
  heroButton: {
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.32)',
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroButtonText: {
    color: '#050505',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  demoStrip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  demoStripText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  landingGlass: {
    flex: 0.9,
    borderRadius: 28,
    padding: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: palette.line,
    gap: 14,
  },
  landingGlassPhone: {
    flex: 0,
    width: '100%',
  },
  heroArtwork: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0b0b0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArtworkLanding: {
    minHeight: 220,
    borderRadius: 28,
    width: '100%',
  },
  heroArtworkPanel: {
    width: 220,
    minHeight: 168,
    borderRadius: 26,
    flexShrink: 0,
  },
  heroArtworkSection: {
    width: 180,
    minHeight: 140,
    borderRadius: 24,
    flexShrink: 0,
  },
  heroPhotoArt: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  heroPhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  glassTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
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
    borderRadius: 24,
    padding: 16,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.line,
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
    color: palette.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  statLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  statDetail: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  landingGrid: {
    gap: 18,
  },
  landingGridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  brandBar: {
    gap: 4,
    marginBottom: 2,
  },
  brandBarTitle: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  brandBarText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  authScreen: {
    minHeight: '100%',
    justifyContent: 'center',
    gap: 18,
    paddingTop: 24,
    paddingBottom: 24,
  },
  authScreenWide: {
    alignItems: 'center',
  },
  authHeader: {
    alignItems: 'center',
    gap: 6,
  },
  authHeaderText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  authCardCompact: {
    width: '100%',
  },
  heroSplit: {
    gap: 18,
  },
  heroSplitWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroContentCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 16,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 2,
  },
  heroContentCardPhone: {
    borderRadius: 24,
    padding: 18,
  },
  heroMediaCard: {
    flex: 1.05,
    minHeight: 360,
    borderRadius: 30,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  heroMediaCardPhone: {
    minHeight: 280,
    borderRadius: 24,
  },
  heroMediaImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  heroMediaOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroMediaCaption: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    gap: 8,
  },
  heroMediaTitle: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    maxWidth: 380,
  },
  heroMediaText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 360,
  },
  miniFeatureGrid: {
    gap: 14,
  },
  miniFeatureGridWide: {
    flexDirection: 'row',
  },
  miniFeatureCard: {
    flex: 1,
    backgroundColor: palette.surfaceAlt,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 6,
  },
  previewStrip: {
    gap: 18,
  },
  previewStripWide: {
    flexDirection: 'row',
  },
  previewTextCard: {
    flex: 1,
    minHeight: 180,
    borderRadius: 24,
    padding: 20,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 8,
    justifyContent: 'flex-end',
  },
  previewImageCard: {
    flex: 1,
    minHeight: 280,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    position: 'relative',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  previewCopy: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(7, 7, 7, 0.72)',
    gap: 4,
  },
  loginShell: {
    gap: 18,
  },
  loginShellWide: {
    flexDirection: 'row',
    minHeight: 720,
    alignItems: 'stretch',
  },
  loginVisual: {
    minHeight: 280,
    borderRadius: 30,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    flex: 1.15,
  },
  loginVisualPhone: {
    minHeight: 240,
    borderRadius: 24,
  },
  loginVisualImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  loginVisualOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  loginVisualCopy: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    gap: 8,
  },
  loginVisualBrand: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  loginVisualText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
  },
  loginCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: palette.surface,
    borderRadius: 30,
    padding: 28,
    gap: 14,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 2,
  },
  loginCardPhone: {
    maxWidth: undefined,
    padding: 20,
    borderRadius: 24,
  },
  loginCardTitle: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  loginCardText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  loginDemoText: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
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
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 16,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 2,
  },
  surfaceCardPhone: {
    padding: 18,
    borderRadius: 26,
  },
  surfaceHeader: {
    gap: 4,
  },
  surfaceTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  surfaceHint: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  featureList: {
    gap: 14,
  },
  featureItem: {
    gap: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  featureTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  featureText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  authCard: {
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 2,
  },
  authCardPhone: {
    borderRadius: 24,
    padding: 18,
  },
  authCardTitle: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
  },
  authCardText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 28,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.line,
  },
  infoCardTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
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
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.line,
  },
  modeChipActive: {
    backgroundColor: '#f2f2f2',
    borderColor: '#f2f2f2',
  },
  modeChipText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  modeChipTextActive: {
    color: '#050505',
  },
  input: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.text,
    fontSize: 14,
    shadowColor: 'transparent',
  },
  multilineInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  primaryWideButton: {
    backgroundColor: palette.accent,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  primaryWideButtonText: {
    color: '#050505',
    fontSize: 14,
    fontWeight: '800',
  },
  error: {
    color: '#f1b4b4',
    fontSize: 13,
    fontWeight: '700',
  },
  completionHero: {
    borderRadius: 30,
    padding: 24,
    gap: 12,
  },
  completionTitle: {
    color: palette.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  completionBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 640,
  },
  formCard: {
    backgroundColor: palette.surface,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 14,
  },
  heroPanel: {
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.line,
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
    alignItems: 'stretch',
  },
  heroPanelCopy: {
    flex: 1,
    gap: 10,
  },
  pageHeroTitle: {
    color: palette.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1,
    maxWidth: 680,
  },
  pageHeroTitlePhone: {
    fontSize: 24,
    lineHeight: 30,
  },
  pageHeroBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 620,
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
    backgroundColor: palette.surfaceMuted,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 6,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  quickActionPhone: {
    minWidth: 0,
    width: '100%',
    padding: 14,
    flexGrow: 0,
    flexBasis: 'auto',
  },
  quickActionLabel: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickActionValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
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
    backgroundColor: palette.surfaceMuted,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
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
    backgroundColor: palette.surfaceMuted,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 12,
  },
  memberBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f2f2f2',
  },
  memberBadgeText: {
    color: '#050505',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  memberRating: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '800',
  },
  memberName: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
  },
  memberMeta: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  memberSkill: {
    color: '#efefef',
    fontSize: 14,
    fontWeight: '800',
  },
  memberBio: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
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
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.line,
  },
  mobileSlotChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.line,
  },
  slotChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  slotChipText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  slotChipTextActive: {
    color: '#050505',
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
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  mobilePrimaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  mobileSecondaryButton: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.line,
  },
  mobileOutlineButton: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    backgroundColor: palette.surface,
  },
  primaryButtonText: {
    color: '#050505',
    fontSize: 13,
    fontWeight: '800',
  },
  softButton: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.line,
  },
  softButtonText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  ghostButton: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    backgroundColor: palette.surface,
  },
  ghostButtonText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  ghostButtonDark: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  ghostButtonDarkText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: palette.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.line,
  },
  filterChipActive: {
    backgroundColor: '#f2f2f2',
    borderColor: '#f2f2f2',
  },
  filterChipText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: '#050505',
  },
  darkCard: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 12,
  },
  darkCardPhone: {
    borderRadius: 24,
    padding: 16,
  },
  darkCardTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  darkCardText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 21,
  },
  mixBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#121212',
  },
  mixMentor: {
    backgroundColor: '#f2f2f2',
  },
  mixLearner: {
    backgroundColor: '#7a7a7a',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  listRowTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  listRowText: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  listRowMeta: {
    color: '#eaeaea',
    fontSize: 12,
    fontWeight: '800',
  },
  stackCard: {
    gap: 4,
    paddingVertical: 8,
  },
  stackCardTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  stackCardText: {
    color: palette.textMuted,
    fontSize: 12,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionHero: {
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
  },
  sectionHeroInner: {
    gap: 16,
  },
  sectionHeroInnerWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeroCopy: {
    flex: 1,
    gap: 10,
  },
  sectionHeroPhone: {
    borderRadius: 24,
    padding: 16,
    gap: 8,
  },
  sectionHeroTitle: {
    color: palette.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.8,
    maxWidth: 700,
  },
  sectionHeroTitlePhone: {
    fontSize: 22,
    lineHeight: 28,
  },
  sectionHeroText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 640,
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
    backgroundColor: palette.surfaceMuted,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 14,
  },
  sessionCardPhone: {
    padding: 16,
  },
  sessionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sessionMeta: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  sessionStatus: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sessionStatusUpcoming: {
    backgroundColor: palette.accentAlt,
  },
  sessionStatusLive: {
    backgroundColor: palette.accentSoft,
  },
  sessionStatusText: {
    color: palette.accentStrong,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  eventCard: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
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
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  eventText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  eventMeta: {
    color: '#f1f1f1',
    fontSize: 18,
    fontWeight: '800',
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
    backgroundColor: '#f0f0f0',
    marginTop: 6,
  },
  notificationBody: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  notificationText: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 19,
  },
  threadCard: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
  },
  threadCardPhone: {
    padding: 14,
  },
  threadName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  threadUnread: {
    color: palette.accentStrong,
    fontSize: 12,
    fontWeight: '800',
  },
  threadTopic: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  threadText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  roadmapTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#151515',
    overflow: 'hidden',
    marginBottom: 8,
  },
  roadmapFill: {
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  roadmapItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  roadmapTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  roadmapState: {
    color: palette.accentStrong,
    fontSize: 12,
    fontWeight: '800',
  },
  profileHeadline: {
    color: palette.accentStrong,
    fontSize: 16,
    fontWeight: '800',
  },
  profileSubline: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  profileBio: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 23,
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
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.line,
  },
  tagText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  bottomDock: {
    backgroundColor: 'rgba(10, 10, 10, 0.96)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
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
    backgroundColor: '#1e1e1e',
  },
  dockText: {
    color: palette.textSoft,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  dockTextPhone: {
    fontSize: 10,
    lineHeight: 12,
  },
  dockTextActive: {
    color: palette.accentStrong,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 14,
  },
  pressedScale: {
    transform: [{ scale: 0.985 }],
  },
});
