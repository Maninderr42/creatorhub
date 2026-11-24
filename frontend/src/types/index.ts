export type Role = 'CREATOR' | 'MERCHANT' | 'ADMIN';

export interface User {
  id: number;
  phone: string;
  email?: string;
  role: Role;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  role: string;
  phone: string;
  userId: number;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface CreatorProfile {
  id: number;
  userId: number;
  phone: string;
  email?: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  categories?: string;
  instagramHandle?: string;
  instagramFollowers?: number;
  isInstagramVerified?: boolean;
  youtubeHandle?: string;
  youtubeSubscribers?: number;
  tiktokHandle?: string;
  tiktokFollowers?: number;
  baseRate?: number;
  totalFollowers?: number;
  portfolioLinks?: string;
  isAvailable: boolean;
  distanceKm?: number;
  isNearby?: boolean;
}

export interface MerchantProfile {
  id: number;
  userId: number;
  phone: string;
  email?: string;
  companyName: string;
  brandName: string;
  logoUrl?: string;
  website?: string;
  industry?: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  contactEmail?: string;
}

export type CompensationType = 'PAID' | 'BARTER' | 'HYBRID';
export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CLOSED';
export type ApplicationStatus = 'APPLIED' | 'ACCEPTED' | 'REJECTED' | 'IN_PROGRESS' | 'DELIVERABLES_SUBMITTED' | 'CHANGES_REQUESTED' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'ESCROWED' | 'PAID' | 'REFUNDED';

export interface Campaign {
  id: number;
  merchantId: number;
  merchantBrandName: string;
  merchantCompanyName?: string;
  merchantLogoUrl?: string;
  merchantCity?: string;
  title: string;
  description: string;
  category: string;
  compensationType: CompensationType;
  budget: number;
  deliverables?: string;
  minFollowers?: number;
  targetCity?: string;
  targetLatitude?: number;
  targetLongitude?: number;
  radiusKm?: number;
  deadline?: string;
  status: CampaignStatus;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: number;
  campaignId: number;
  campaignTitle: string;
  campaignCategory: string;
  campaignBudget: number;
  campaignTargetCity?: string;
  merchantId: number;
  merchantBrandName: string;
  merchantLogoUrl?: string;
  creatorId: number;
  creatorName: string;
  creatorPhone: string;
  creatorEmail?: string;
  creatorAvatarUrl?: string;
  creatorCity?: string;
  creatorTotalFollowers: number;
  creatorCategories?: string;
  creatorInstagramHandle?: string;
  pitch: string;
  proposedRate: number;
  status: ApplicationStatus;
  deliverableUrl?: string;
  deliverableNotes?: string;
  paymentStatus: PaymentStatus;
  merchantFeedback?: string;
  creatorFeedback?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  applicationId: number;
  senderId: number;
  senderName: string;
  senderRole: 'CREATOR' | 'MERCHANT' | 'ADMIN';
  senderAvatarUrl?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  isMine: boolean;
}

export interface ChatThread {
  applicationId: number;
  campaignId: number;
  campaignTitle: string;
  partnerName: string;
  partnerAvatarUrl?: string;
  partnerRole: string;
  partnerPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: ApplicationStatus;
}

export type NotificationType =
  | 'COLLAB_INVITE'
  | 'APPLICATION_RECEIVED'
  | 'APPLICATION_ACCEPTED'
  | 'APPLICATION_REJECTED'
  | 'DELIVERABLES_SUBMITTED'
  | 'CHANGES_REQUESTED'
  | 'COLLAB_COMPLETED'
  | 'CHAT_MESSAGE'
  | 'FUNDS_ESCROWED'
  | 'FUNDS_RELEASED'
  | 'PAYOUT_PROCESSED'
  | 'SYSTEM';

export interface NotificationItem {
  id: number;
  recipientId: number;
  senderId?: number;
  senderName?: string;
  senderAvatarUrl?: string;
  title: string;
  message: string;
  type: NotificationType;
  referenceId?: number;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

export type PayoutMethod = 'UPI' | 'BANK_TRANSFER';
export type PayoutStatus = 'REQUESTED' | 'PROCESSING' | 'TRANSFERRED' | 'FAILED';

export interface Payment {
  id: number;
  transactionId: string;
  applicationId: number;
  campaignTitle: string;
  payerId: number;
  payerName: string;
  recipientId: number;
  recipientName: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  gatewayName: string;
  gatewayPaymentId?: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutRequest {
  id: number;
  creatorId: number;
  amount: number;
  payoutMethod: PayoutMethod;
  upiId?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
  status: PayoutStatus;
  utrNumber?: string;
  processedAt: string;
  createdAt: string;
}

export interface CreatorWallet {
  lifetimeEarnings: number;
  inEscrow: number;
  totalWithdrawn: number;
  availableBalance: number;
  recentEscrowDeals: Payment[];
  recentPayouts: PayoutRequest[];
}

export interface PaymentOrderResponse {
  keyId: string;
  orderId: string;
  transactionId: string;
  applicationId: number;
  collabTitle: string;
  creatorName: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  brandName: string;
  userPhone: string;
  userEmail: string;
}

