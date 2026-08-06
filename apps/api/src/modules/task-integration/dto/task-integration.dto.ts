import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class TaskDemandCallbackDto {
  @IsUUID()
  externalRequestId: string;

  @IsUUID()
  demandId: string;

  @IsString()
  protocol: string;

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
  @IsUUID()
  responsibleId?: string;

  @IsOptional()
  @IsString()
  responsibleName?: string;

  @IsOptional()
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
  @IsDateString()
  editorLastSeenAt?: string;

  @IsOptional()
  @IsString()
  workflowStage?: string;

  @IsOptional()
  @IsArray()
  attachments?: Array<{
    id: string;
    name: string;
    mimeType?: string;
    size?: number;
    createdAt?: string;
  }>;
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
