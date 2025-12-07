/**
 * Metadata Type Definitions
 *
 * Type-safe metadata structures replacing generic Record<string, any>
 * These types provide compile-time safety for metadata fields used throughout the application
 */

import { ISODateString, JSONValue } from './utility';

// ============================================
// CONTACT METADATA
// ============================================

/**
 * Contact metadata structure
 * Stores additional information about a contact
 */
export interface ContactMetadata {
  /**
   * Contact's preferred language
   * ISO 639-1 language code
   */
  preferredLanguage?: 'pt-BR' | 'en-US' | 'es-ES' | string;

  /**
   * Contact's timezone
   * IANA timezone identifier
   */
  timezone?: string;

  /**
   * Custom tags applied to the contact
   */
  tags?: string[];

  /**
   * Contact source/origin
   */
  source?: ContactSource;

  /**
   * Last interaction timestamp
   */
  lastInteraction?: ISODateString;

  /**
   * Contact preferences
   */
  preferences?: ContactPreferences;

  /**
   * Custom fields defined by tenant
   * Key is field name, value is field data
   */
  customFields?: Record<string, CustomFieldValue>;

  /**
   * Social media profiles
   */
  socialProfiles?: SocialProfiles;

  /**
   * Contact notes
   */
  notes?: ContactNote[];

  /**
   * Lifecycle stage
   */
  lifecycleStage?: ContactLifecycleStage;

  /**
   * Lead score (0-100)
   */
  leadScore?: number;

  /**
   * Company information (for B2B)
   */
  company?: CompanyInfo;

  /**
   * Whether contact is VIP
   */
  isVip?: boolean;

  /**
   * Guest information (for hotel context)
   */
  guestInfo?: GuestInfo;
}

/**
 * Contact source/origin
 */
export interface ContactSource {
  /**
   * Source channel
   */
  channel: 'whatsapp' | 'web' | 'mobile' | 'email' | 'phone' | 'referral' | 'other';

  /**
   * Campaign identifier
   */
  campaign?: string;

  /**
   * UTM parameters
   */
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };

  /**
   * Referrer URL
   */
  referrer?: string;

  /**
   * When contact was acquired
   */
  acquiredAt?: ISODateString;
}

/**
 * Contact communication preferences
 */
export interface ContactPreferences {
  /**
   * Preferred contact method
   */
  preferredContactMethod?: 'whatsapp' | 'email' | 'phone' | 'sms';

  /**
   * Marketing opt-in status
   */
  marketingOptIn?: boolean;

  /**
   * Notification preferences
   */
  notifications?: {
    promotional?: boolean;
    transactional?: boolean;
    reminders?: boolean;
  };

  /**
   * Best time to contact
   */
  bestTimeToContact?: {
    days?: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
    timeRange?: {
      start: string; // HH:mm format
      end: string;
    };
  };

  /**
   * Communication frequency preference
   */
  communicationFrequency?: 'daily' | 'weekly' | 'monthly' | 'minimal';
}

/**
 * Custom field value types
 */
export type CustomFieldValue =
  | string
  | number
  | boolean
  | ISODateString
  | string[]
  | null;

/**
 * Social media profiles
 */
export interface SocialProfiles {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  tiktok?: string;
}

/**
 * Contact note
 */
export interface ContactNote {
  id: string;
  content: string;
  createdBy: string;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
  isPinned?: boolean;
}

/**
 * Contact lifecycle stage
 */
export type ContactLifecycleStage =
  | 'lead'
  | 'marketing_qualified_lead'
  | 'sales_qualified_lead'
  | 'opportunity'
  | 'customer'
  | 'evangelist'
  | 'churned';

/**
 * Company information (B2B)
 */
export interface CompanyInfo {
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  revenue?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}

/**
 * Guest information (hotel context)
 */
export interface GuestInfo {
  /**
   * Number of previous stays
   */
  numberOfStays?: number;

  /**
   * Preferred room type
   */
  preferredRoomType?: string;

  /**
   * Special requests/preferences
   */
  preferences?: {
    roomLocation?: string;
    bedType?: string;
    pillowType?: string;
    smokingRoom?: boolean;
    petFriendly?: boolean;
  };

  /**
   * Loyalty program information
   */
  loyaltyProgram?: {
    memberId?: string;
    tier?: string;
    points?: number;
  };

  /**
   * Dietary restrictions
   */
  dietaryRestrictions?: string[];

  /**
   * Allergies
   */
  allergies?: string[];

  /**
   * Special occasions
   */
  specialOccasions?: Array<{
    type: 'birthday' | 'anniversary' | 'other';
    date: string; // MM-DD format
    notes?: string;
  }>;

  /**
   * Last stay information
   */
  lastStay?: {
    checkIn: ISODateString;
    checkOut: ISODateString;
    hotelUnit: string;
    roomNumber?: string;
  };
}

// ============================================
// MESSAGE METADATA
// ============================================

/**
 * Message metadata structure
 * Stores additional information about a message
 */
export interface MessageMetadata {
  /**
   * WhatsApp-specific metadata
   */
  whatsapp?: WhatsAppMessageMetadata;

  /**
   * AI-generated metadata
   */
  ai?: AIMessageMetadata;

  /**
   * Message context
   */
  context?: MessageContext;

  /**
   * Delivery information
   */
  delivery?: MessageDeliveryInfo;

  /**
   * Message analytics
   */
  analytics?: MessageAnalytics;

  /**
   * Forwarding information
   */
  forwarded?: boolean;

  /**
   * Quote/reply information
   */
  quotedMessage?: {
    id: string;
    content: string;
    senderId: string;
    timestamp: ISODateString;
  };

  /**
   * Rich content data
   */
  richContent?: RichContentMetadata;
}

/**
 * WhatsApp-specific message metadata
 */
export interface WhatsAppMessageMetadata {
  /**
   * WhatsApp message ID
   */
  messageId?: string;

  /**
   * Message type
   */
  type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'interactive' | 'template';

  /**
   * Interactive message data
   */
  interactive?: {
    type: 'button' | 'list' | 'product' | 'product_list';
    buttonId?: string;
    listItemId?: string;
    title?: string;
  };

  /**
   * Template information
   */
  template?: {
    name: string;
    language: string;
    components?: Array<{
      type: string;
      parameters?: JSONValue[];
    }>;
  };

  /**
   * Media information
   */
  media?: {
    mimeType?: string;
    sha256?: string;
    fileSize?: number;
    duration?: number; // For audio/video
    caption?: string;
  };

  /**
   * Location data
   */
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };

  /**
   * Contact card data
   */
  contacts?: Array<{
    name: string;
    phones?: string[];
    emails?: string[];
  }>;

  /**
   * Reaction information
   */
  reaction?: {
    emoji: string;
    messageId: string;
  };

  /**
   * Business profile information
   */
  business?: {
    verified: boolean;
    name: string;
  };
}

/**
 * AI-generated message metadata
 */
export interface AIMessageMetadata {
  /**
   * Whether message was generated by AI
   */
  generated?: boolean;

  /**
   * AI model used
   */
  model?: string;

  /**
   * AI confidence score (0-1)
   */
  confidence?: number;

  /**
   * Intent detected
   */
  intent?: {
    name: string;
    confidence: number;
  };

  /**
   * Entities extracted
   */
  entities?: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;

  /**
   * Sentiment analysis
   */
  sentiment?: {
    type: 'positive' | 'neutral' | 'negative';
    score: number; // -1 to 1
  };

  /**
   * Language detected
   */
  language?: string;

  /**
   * Topics identified
   */
  topics?: string[];

  /**
   * AI suggestions
   */
  suggestions?: string[];

  /**
   * Whether AI suggested escalation
   */
  suggestEscalation?: boolean;

  /**
   * Escalation reason if suggested
   */
  escalationReason?: string;
}

/**
 * Message context information
 */
export interface MessageContext {
  /**
   * Conversation stage
   */
  conversationStage?: 'initial' | 'ongoing' | 'closing';

  /**
   * User journey step
   */
  journeyStep?: string;

  /**
   * Business process context
   */
  process?: {
    name: string;
    step: string;
    data?: Record<string, JSONValue>;
  };

  /**
   * Related entities
   */
  relatedEntities?: Array<{
    type: 'booking' | 'order' | 'ticket' | 'other';
    id: string;
    data?: Record<string, JSONValue>;
  }>;
}

/**
 * Message delivery information
 */
export interface MessageDeliveryInfo {
  /**
   * Timestamps for each status
   */
  timestamps?: {
    sent?: ISODateString;
    delivered?: ISODateString;
    read?: ISODateString;
    failed?: ISODateString;
  };

  /**
   * Retry information
   */
  retries?: {
    count: number;
    lastAttempt?: ISODateString;
    nextAttempt?: ISODateString;
  };

  /**
   * Error information if failed
   */
  error?: {
    code: string;
    message: string;
    details?: JSONValue;
  };

  /**
   * Delivery channel
   */
  channel?: string;

  /**
   * Message priority
   */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Message analytics data
 */
export interface MessageAnalytics {
  /**
   * Time to first response (in seconds)
   */
  timeToFirstResponse?: number;

  /**
   * Time to resolution (in seconds)
   */
  timeToResolution?: number;

  /**
   * Number of interactions
   */
  interactionCount?: number;

  /**
   * Response time (in seconds)
   */
  responseTime?: number;

  /**
   * User engagement score
   */
  engagementScore?: number;

  /**
   * Conversion tracking
   */
  conversion?: {
    converted: boolean;
    value?: number;
    type?: string;
  };
}

/**
 * Rich content metadata
 */
export type RichContentMetadata =
  | CarouselMetadata
  | FormMetadata
  | ProductMetadata
  | CalendarMetadata;

/**
 * Carousel message metadata
 */
export interface CarouselMetadata {
  type: 'carousel';
  items: Array<{
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    action?: {
      type: 'url' | 'postback';
      value: string;
    };
  }>;
}

/**
 * Form metadata
 */
export interface FormMetadata {
  type: 'form';
  formId: string;
  fields: Array<{
    name: string;
    type: string;
    value?: JSONValue;
    required: boolean;
  }>;
  submitted: boolean;
  submittedAt?: ISODateString;
}

/**
 * Product metadata
 */
export interface ProductMetadata {
  type: 'product';
  productId: string;
  catalogId: string;
  name: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  action?: 'view' | 'add_to_cart' | 'purchase';
}

/**
 * Calendar/appointment metadata
 */
export interface CalendarMetadata {
  type: 'calendar';
  eventId: string;
  title: string;
  startTime: ISODateString;
  endTime: ISODateString;
  location?: string;
  description?: string;
  attendees?: string[];
  status?: 'proposed' | 'confirmed' | 'cancelled';
}

// ============================================
// CONVERSATION METADATA
// ============================================

/**
 * Conversation metadata structure
 * Stores additional information about a conversation
 */
export interface ConversationMetadata {
  /**
   * Conversation summary
   */
  summary?: string;

  /**
   * AI-generated insights
   */
  aiInsights?: AIConversationInsights;

  /**
   * Customer journey stage
   */
  journeyStage?: CustomerJourneyStage;

  /**
   * Business context
   */
  business?: BusinessConversationContext;

  /**
   * Analytics data
   */
  analytics?: ConversationAnalytics;

  /**
   * Quality metrics
   */
  quality?: ConversationQualityMetrics;

  /**
   * Automation data
   */
  automation?: ConversationAutomationData;

  /**
   * Integration data
   */
  integrations?: Record<string, IntegrationData>;

  /**
   * Conversation outcome
   */
  outcome?: ConversationOutcome;
}

/**
 * AI insights for conversation
 */
export interface AIConversationInsights {
  /**
   * Overall sentiment
   */
  overallSentiment?: {
    type: 'positive' | 'neutral' | 'negative';
    score: number;
    trend?: 'improving' | 'stable' | 'declining';
  };

  /**
   * Customer satisfaction prediction
   */
  csatPrediction?: {
    score: number; // 1-5
    confidence: number;
  };

  /**
   * Detected topics
   */
  topics?: Array<{
    name: string;
    relevance: number;
  }>;

  /**
   * Suggested actions
   */
  suggestedActions?: Array<{
    action: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
  }>;

  /**
   * Risk indicators
   */
  riskIndicators?: Array<{
    type: 'churn' | 'complaint' | 'escalation' | 'fraud';
    level: 'low' | 'medium' | 'high';
    reason: string;
  }>;
}

/**
 * Customer journey stage
 */
export type CustomerJourneyStage =
  | 'awareness'
  | 'consideration'
  | 'decision'
  | 'retention'
  | 'advocacy';

/**
 * Business context for conversation
 */
export interface BusinessConversationContext {
  /**
   * Business unit/department
   */
  department?: string;

  /**
   * Product/service discussed
   */
  product?: string;

  /**
   * Deal value
   */
  dealValue?: number;

  /**
   * Booking/reservation information (hotel context)
   */
  booking?: BookingInfo;

  /**
   * Related transactions
   */
  transactions?: Array<{
    id: string;
    type: string;
    amount?: number;
    status?: string;
    timestamp: ISODateString;
  }>;
}

/**
 * Booking information (hotel context)
 */
export interface BookingInfo {
  /**
   * Booking reference
   */
  reference?: string;

  /**
   * Hotel unit
   */
  hotelUnit?: string;

  /**
   * Check-in date
   */
  checkIn?: ISODateString;

  /**
   * Check-out date
   */
  checkOut?: ISODateString;

  /**
   * Room type
   */
  roomType?: string;

  /**
   * Number of guests
   */
  guests?: number;

  /**
   * Booking status
   */
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';

  /**
   * Total price
   */
  totalPrice?: number;

  /**
   * Currency
   */
  currency?: string;

  /**
   * Special requests
   */
  specialRequests?: string[];
}

/**
 * Conversation analytics
 */
export interface ConversationAnalytics {
  /**
   * Total messages count
   */
  messageCount?: number;

  /**
   * Average response time (seconds)
   */
  avgResponseTime?: number;

  /**
   * First response time (seconds)
   */
  firstResponseTime?: number;

  /**
   * Resolution time (seconds)
   */
  resolutionTime?: number;

  /**
   * Number of escalations
   */
  escalationCount?: number;

  /**
   * Number of transfers
   */
  transferCount?: number;

  /**
   * Customer effort score
   */
  effortScore?: number;

  /**
   * Conversation duration (seconds)
   */
  duration?: number;
}

/**
 * Conversation quality metrics
 */
export interface ConversationQualityMetrics {
  /**
   * Customer satisfaction score (1-5)
   */
  csat?: number;

  /**
   * Net Promoter Score (0-10)
   */
  nps?: number;

  /**
   * Quality score (0-100)
   */
  qualityScore?: number;

  /**
   * Agent performance rating
   */
  agentRating?: number;

  /**
   * Resolution quality
   */
  resolutionQuality?: 'poor' | 'fair' | 'good' | 'excellent';

  /**
   * Feedback provided by customer
   */
  feedback?: string;
}

/**
 * Conversation automation data
 */
export interface ConversationAutomationData {
  /**
   * Automation level
   */
  level?: 'none' | 'partial' | 'full';

  /**
   * Bot handled percentage
   */
  botHandledPercentage?: number;

  /**
   * Workflows triggered
   */
  workflows?: Array<{
    id: string;
    name: string;
    triggeredAt: ISODateString;
    completed: boolean;
  }>;

  /**
   * Auto-responses sent
   */
  autoResponseCount?: number;

  /**
   * Handoff information
   */
  handoff?: {
    timestamp: ISODateString;
    reason: string;
    fromBot: boolean;
  };
}

/**
 * Integration-specific data
 */
export interface IntegrationData {
  /**
   * Integration name
   */
  name: string;

  /**
   * External reference ID
   */
  externalId?: string;

  /**
   * Integration-specific data
   */
  data: Record<string, JSONValue>;

  /**
   * Sync status
   */
  syncStatus?: {
    lastSync: ISODateString;
    status: 'synced' | 'pending' | 'failed';
  };
}

/**
 * Conversation outcome
 */
export interface ConversationOutcome {
  /**
   * Outcome type
   */
  type: 'resolved' | 'converted' | 'escalated' | 'abandoned' | 'ongoing';

  /**
   * Resolution details
   */
  resolution?: {
    category: string;
    subcategory?: string;
    notes?: string;
  };

  /**
   * Conversion details
   */
  conversion?: {
    type: string;
    value?: number;
    product?: string;
  };

  /**
   * Follow-up required
   */
  followUpRequired?: boolean;

  /**
   * Follow-up date
   */
  followUpDate?: ISODateString;

  /**
   * Outcome timestamp
   */
  timestamp: ISODateString;
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Type guard for contact metadata
 */
export function isContactMetadata(metadata: unknown): metadata is ContactMetadata {
  return (
    typeof metadata === 'object' &&
    metadata !== null
  );
}

/**
 * Type guard for message metadata
 */
export function isMessageMetadata(metadata: unknown): metadata is MessageMetadata {
  return (
    typeof metadata === 'object' &&
    metadata !== null
  );
}

/**
 * Type guard for conversation metadata
 */
export function isConversationMetadata(metadata: unknown): metadata is ConversationMetadata {
  return (
    typeof metadata === 'object' &&
    metadata !== null
  );
}
