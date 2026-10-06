import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

function blankToUndefined({ value }: { value: unknown }) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

function optionalIsoDate({ value }: { value: unknown }) {
  const present = blankToUndefined({ value });
  if (present === undefined) return undefined;
  const parsed = new Date(String(present));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function optionalUuid({ value }: { value: unknown }) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function optionalNumber({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return value;
}

export function normalizeIncomingTaskStatus(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_');
  if (['concluido', 'concluida', 'completed', 'finalizado', 'finalizada'].includes(normalized)) {
    return 'concluido';
  }
  if (['cancelado', 'cancelada', 'rejected'].includes(normalized)) return 'cancelado';
  if (['em_aberto', 'aberto', 'aberta', 'open'].includes(normalized)) return 'em_aberto';
  if (['em_andamento', 'andamento', 'in_progress'].includes(normalized)) return 'em_andamento';
  if (normalized === 'standby') return 'standby';
  return normalized;
}

export class TaskCallbackAttachmentDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  mimeType?: string;

  @IsOptional()
  @Transform(optionalNumber)
  @IsNumber()
  size?: number;

  @IsOptional()
  @Transform(optionalIsoDate)
  @IsDateString()
  createdAt?: string;

  @IsOptional()
  @IsString()
  contentBase64?: string;
}

export class TaskDemandCallbackDto {
  @IsUUID()
  externalRequestId: string;

  @IsUUID()
  demandId: string;

  @IsString()
  protocol: string;

  @Transform(({ value }) => normalizeIncomingTaskStatus(value))
  @IsIn(['em_aberto', 'em_andamento', 'concluido', 'standby', 'cancelado'])
  status: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  observations?: string[];

  @IsOptional()
  @Transform(optionalUuid)
  @IsUUID()
  responsibleId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  responsibleName?: string;

  @IsOptional()
  @Transform(optionalIsoDate)
  @IsDateString()
  updatedAt?: string;

  @IsOptional()
  @IsBoolean()
  isBeingEdited?: boolean;

  @IsOptional()
  @IsString()
  editorName?: string;

  @IsOptional()
  @IsString()
  editorActivity?: string;

  @IsOptional()
  @Transform(optionalIsoDate)
  @IsDateString()
  editorLastSeenAt?: string;

  @IsOptional()
  @IsString()
  workflowStage?: string;

  @IsOptional()
  @IsIn(['luxus_task', 'luxus_parceiros', 'parceiro'])
  turnRequestFrom?: string | null;

  @IsOptional()
  @IsString()
  turnRequestReason?: string | null;

  @IsOptional()
  @IsBoolean()
  clearTurnRequest?: boolean;

  /** Cobrança/aviso do Luxus Task (assinaturas pendentes etc.) — só notificação. */
  @IsOptional()
  @IsString()
  reminderMessage?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskCallbackAttachmentDto)
  attachments?: TaskCallbackAttachmentDto[];
}

export class CreateTaskDemandInput {
  @IsOptional()
  @IsIn(['request', 'sale'])
  entityType?: 'request' | 'sale';

  @IsUUID()
  requestId: string;

  @IsUUID()
  responsibleId: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsIn(['pf', 'pj'])
  clientDocumentType?: 'pf' | 'pj';

  @IsOptional()
  @IsString()
  clientDocument?: string;

  @IsDateString()
  deadline: string;

  @IsString()
  subject: string;

  @IsString()
  description: string;

  /** Dados da venda/cliente — não deve ir para o campo de instruções do template. */
  @IsOptional()
  @IsString()
  observations?: string;

  /** Deixar vazio: instruções nativas ficam só no template do Task. */
  @IsOptional()
  @IsString()
  instructions?: string;

  @IsString()
  localProtocol: string;

  @IsString()
  partnerName: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsString()
  requesterName: string;

  @IsString()
  requesterEmail: string;

  /** Rótulo do criador para filtro no Luxus Task. */
  @IsOptional()
  @IsString()
  creatorName?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsBoolean()
  priority?: boolean;

  @IsOptional()
  @IsArray()
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    mimeType: string;
    size: number;
    contentBase64?: string;
  }>;
}

export class UpdateTaskSaleStageInput {
  @IsString()
  stage: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  documentName?: string;

  @IsOptional()
  @IsString()
  documentMimeType?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
