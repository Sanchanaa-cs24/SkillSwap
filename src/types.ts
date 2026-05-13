export type Persona = 'teacher' | 'learner';

export type Tab = 'Discover' | 'Sessions' | 'Community' | 'Progress' | 'Profile';

export type DiscoveryCard = {
  id: string;
  name: string;
  persona: Persona;
  title: string;
  skill: string;
  category: string;
  country: string;
  rating: number;
  bio: string;
  nextSessionSlots: string[];
  connected: boolean;
  favorited: boolean;
};

export type Session = {
  id: string;
  cardId: string;
  with: string;
  skill: string;
  time: string;
  status: 'upcoming' | 'live' | 'completed';
  createdAt: string;
  calendarUrl: string;
};

export type CommunityEvent = {
  id: string;
  title: string;
  description: string;
  participants: number;
  joined: boolean;
};

export type LearningPlan = {
  profileCompleted: boolean;
  firstSessionBooked: boolean;
  challengeJoined: boolean;
  skillsTarget: number;
  skillsCompleted: number;
};

export type Messages = {
  unreadCount: number;
};

export type AppNotification = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  read: boolean;
};

export type MessageThread = {
  id: string;
  participant: string;
  topic: string;
  unread: number;
  lastMessage: string;
  lastAt: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  headline: string;
  bio: string;
  country: string;
  skillsOffered: string[];
  skillsToLearn: string[];
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type PublicOverview = {
  totalMembers: number;
  mentorCount: number;
  learnerCount: number;
  sessionCount: number;
  categories: string[];
  featuredCards: DiscoveryCard[];
  featuredEvents: CommunityEvent[];
};
