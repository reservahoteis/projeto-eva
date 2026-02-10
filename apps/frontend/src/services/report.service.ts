import api from '@/lib/axios';
import { ConversationStatus } from '@/types';

const REPORT_API_BASE_URL = '/api/reports' as const;

export interface ReportPeriod {
  period?: '7d' | '30d' | '90d' | '1y';
}

export interface OverviewData {
  totalConversations: number;
  conversationsChange: number;
  averageResponseTime: number;
  resolutionRate: number;
  activeAttendants: number;
  totalAttendants: number;
}

export interface StatusBreakdown {
  status: ConversationStatus;
  count: number;
  percentage: number;
}

export interface OverviewResponse {
  period: string;
  overview: OverviewData;
  statusBreakdown: StatusBreakdown[];
}

export interface AttendantPerformance {
  id: string;
  name: string;
  email: string;
  conversationsCount: number;
  satisfactionRate: number;
}

export interface AttendantsResponse {
  period: string;
  attendants: AttendantPerformance[];
}

export interface HourlyVolumeData {
  hour: number;
  count: number;
  isBusinessHour: boolean;
}

export interface BusinessHoursMetrics {
  businessHoursStart: number;
  businessHoursEnd: number;
  insideCount: number;
  outsideCount: number;
  outsidePercentage: number;
}

export interface HourlyVolumeResponse {
  period: string;
  hourlyVolume: HourlyVolumeData[];
  businessHoursMetrics: BusinessHoursMetrics;
}

export interface OutsideHoursContact {
  id: string;
  name: string | null;
  phoneNumber: string;
  profilePictureUrl: string | null;
}

export interface OutsideHoursConversation {
  id: string;
  status: string;
  createdAt: string;
  lastMessageAt: string | null;
  hotelUnit: string | null;
  contact: OutsideHoursContact;
  assignedTo: { id: string; name: string } | null;
}

export interface OutsideHoursResponse {
  period: string;
  total: number;
  conversations: OutsideHoursConversation[];
}

class ReportService {
  async getOverview(params?: ReportPeriod): Promise<OverviewResponse> {
    const { data } = await api.get<OverviewResponse>(
      `${REPORT_API_BASE_URL}/overview`,
      { params }
    );
    return data;
  }

  async getAttendantsPerformance(params?: ReportPeriod): Promise<AttendantsResponse> {
    const { data } = await api.get<AttendantsResponse>(
      `${REPORT_API_BASE_URL}/attendants`,
      { params }
    );
    return data;
  }

  async getHourlyVolume(params?: ReportPeriod): Promise<HourlyVolumeResponse> {
    const { data } = await api.get<HourlyVolumeResponse>(
      `${REPORT_API_BASE_URL}/hourly`,
      { params }
    );
    return data;
  }

  async getOutsideBusinessHours(params?: ReportPeriod): Promise<OutsideHoursResponse> {
    const { data } = await api.get<OutsideHoursResponse>(
      `${REPORT_API_BASE_URL}/outside-hours`,
      { params }
    );
    return data;
  }

  formatResponseTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}min`
      : `${hours}h`;
  }

  getStatusLabel(status: ConversationStatus): string {
    const labels: Record<ConversationStatus, string> = {
      [ConversationStatus.BOT_HANDLING]: 'Bot Atendendo',
      [ConversationStatus.OPEN]: 'Abertas',
      [ConversationStatus.IN_PROGRESS]: 'Em Andamento',
      [ConversationStatus.WAITING]: 'Aguardando',
      [ConversationStatus.CLOSED]: 'Fechadas',
      [ConversationStatus.ARCHIVED]: 'Arquivadas',
    };
    return labels[status] || status;
  }

  getStatusColor(status: ConversationStatus): string {
    const colors: Record<ConversationStatus, string> = {
      [ConversationStatus.BOT_HANDLING]: 'bg-purple-500',
      [ConversationStatus.OPEN]: 'bg-yellow-500',
      [ConversationStatus.IN_PROGRESS]: 'bg-blue-500',
      [ConversationStatus.WAITING]: 'bg-orange-500',
      [ConversationStatus.CLOSED]: 'bg-green-500',
      [ConversationStatus.ARCHIVED]: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  }
}

export const reportService = new ReportService();
