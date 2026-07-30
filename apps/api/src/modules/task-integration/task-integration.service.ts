import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { TaskDemandCallbackDto, CreateTaskDemandInput } from './dto/task-integration.dto';

export interface TaskResponsible {
  id: string;
  name: string;
  email: string;
}

export interface TaskClient {
  id: string;
  name: string;
  document?: string;
  tradeName?: string;
  personType?: string;
}

export interface CreatedTaskDemand {
  id: string;
  protocol: string;
  status: string;
  responsible?: TaskResponsible;
  client?: TaskClient;
  updatedAt?: string;
}

@Injectable()
export class TaskIntegrationService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.integrationKey);
  }

  async listResponsibles(): Promise<TaskResponsible[]> {
    return this.request<TaskResponsible[]>('/integrations/luxus-parceiros/responsaveis');
  }

  async listClients(search?: string): Promise<TaskClient[]> {
    const query = search?.trim()
      ? `?search=${encodeURIComponent(search.trim())}`
      : '';
    return this.request<TaskClient[]>(
      `/integrations/luxus-parceiros/clientes${query}`,
    );
  }

  async createDemand(input: CreateTaskDemandInput): Promise<CreatedTaskDemand> {
    return this.request<CreatedTaskDemand>('/integrations/luxus-parceiros/demandas', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getDemand(externalRequestId: string): Promise<CreatedTaskDemand & {
    resolution?: string;
    observations?: string[];
  }> {
    return this.request(
      `/integrations/luxus-parceiros/demandas/${encodeURIComponent(externalRequestId)}`,
      undefined,
      10_000,
    );
  }

  async applyCallback(dto: TaskDemandCallbackDto) {
    const existing = await this.prisma.request.findUnique({
      where: { id: dto.externalRequestId },
      select: {
        id: true,
        protocol: true,
        partnerId: true,
        createdById: true,
        createdBy: { select: { partnerId: true } },
        taskDemandId: true,
        status: true,
        resolution: true,
      },
    });
    if (!existing) return { accepted: true };
    if (existing.taskDemandId && existing.taskDemandId !== dto.demandId) {
      throw new BadGatewayException('A demanda não corresponde à solicitação informada');
    }

    const status = this.mapTaskStatus(dto.status);
    const resolution =
      dto.resolution?.trim() ||
      dto.observations?.filter(Boolean).at(-1)?.trim() ||
      undefined;
    const resolutionChanged = Boolean(
      resolution && resolution !== existing.resolution,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: existing.id },
        data: {
          taskDemandId: dto.demandId,
          taskProtocol: dto.protocol,
          taskStatus: dto.status,
          taskResponsibleId: dto.responsibleId,
          taskResponsibleName: dto.responsibleName,
          taskSyncError: null,
          taskLastSyncAt: dto.updatedAt ? new Date(dto.updatedAt) : new Date(),
          status,
          ...(resolution && { resolution }),
          ...(status === 'COMPLETED' && { completedAt: new Date() }),
        },
      });
      if (status !== existing.status || resolutionChanged) {
        await tx.requestTimeline.create({
          data: {
            requestId: existing.id,
            action: status !== existing.status
              ? 'Status sincronizado pelo Luxus Task'
              : 'Resposta sincronizada pelo Luxus Task',
            fromStatus: existing.status,
            toStatus: status,
            details: resolution,
          },
        });
      }
    });
    if (status !== existing.status || resolutionChanged) {
      const statusLabels: Record<string, string> = {
        OPEN: 'aberta',
        IN_ANALYSIS: 'em análise',
        IN_PROGRESS: 'em andamento',
        COMPLETED: 'concluída',
        REJECTED: 'rejeitada',
      };
      const notification = {
        type: 'REQUEST' as const,
        title: status !== existing.status
          ? 'Atualização do Luxus Task'
          : 'Nova resposta do Luxus Task',
        message: status !== existing.status
          ? `A solicitação ${existing.protocol} agora está ${statusLabels[status] ?? 'atualizada'}.`
          : `A solicitação ${existing.protocol} recebeu uma nova resposta.`,
        data: { requestId: existing.id },
      };
      await this.notifications.createForPartnerUsers(
        existing.partnerId,
        notification,
        [existing.createdById],
      );
      if (!existing.createdBy.partnerId) {
        await this.notifications.create({
          userId: existing.createdById,
          ...notification,
        });
      }
    }
    return { accepted: true };
  }

  private mapTaskStatus(status: string) {
    const values = {
      em_aberto: 'OPEN',
      em_andamento: 'IN_PROGRESS',
      concluido: 'COMPLETED',
      standby: 'IN_ANALYSIS',
      cancelado: 'REJECTED',
    } as const;
    return values[status as keyof typeof values] ?? 'IN_ANALYSIS';
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    timeoutMs = this.timeoutMs,
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Integração com o Luxus Task ainda não foi configurada',
      );
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.apiUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-integration-key': this.integrationKey!,
          ...init?.headers,
        },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new BadGatewayException(
          body?.message || `Luxus Task respondeu com HTTP ${response.status}`,
        );
      }
      return body as T;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadGatewayException(
          'O Luxus Task demorou para responder. A demanda pode já ter sido criada; tente sincronizar novamente para confirmar sem duplicar.',
        );
      }
      throw new BadGatewayException(
        error instanceof Error
          ? `Não foi possível acessar o Luxus Task: ${error.message}`
          : 'Não foi possível acessar o Luxus Task',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private get apiUrl(): string | undefined {
    return this.config.get<string>('LUXUS_TASK_API_URL')?.trim().replace(/\/+$/, '');
  }

  private get integrationKey(): string | undefined {
    return this.config.get<string>('LUXUS_TASK_INTEGRATION_KEY')?.trim();
  }

  private get timeoutMs(): number {
    const configured = Number(this.config.get<string>('LUXUS_TASK_TIMEOUT_MS'));
    return Number.isFinite(configured) && configured >= 15_000
      ? Math.min(configured, 120_000)
      : 90_000;
  }
}
