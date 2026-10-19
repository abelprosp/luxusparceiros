import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsObject } from 'class-validator';
import { SALES_IMPORT_MAX_ROWS, SalesImportMode, SalesImportRawRow } from '../sales-import.parse';

export class ImportSalesDto {
  @ApiProperty({
    enum: ['new', 'concluded'],
    description: 'new = vai para análise e depois ao Luxus Task; concluded = já concluída no Luxus Task',
  })
  @IsIn(['new', 'concluded'])
  mode: SalesImportMode;

  @ApiProperty({ description: 'Linhas da planilha padrão, já convertidas para as chaves da importação' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SALES_IMPORT_MAX_ROWS)
  @IsObject({ each: true })
  rows: SalesImportRawRow[];
}
