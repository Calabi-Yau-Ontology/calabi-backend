import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { OntologyRun } from './entities/ontology-run.entity';
import { OntologyRunService } from './ontology-run.service';
import { OntologyAdminService } from './ontology-admin.service';
import { CreateOntologyRunDto } from './dto/create-ontology-run.dto';
import { ConfirmOntologyRunDto } from './dto/confirm-ontology-run.dto';
import { ListOntologyRunsDto } from './dto/list-ontology-runs.dto';
import { ApplyOntologyRunDto } from './dto/apply-ontology-run.dto';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { OntologySnapshotResponseDto } from './dto/ontology-snapshot.dto';
import { UnclassifiedContextDto } from './dto/unclassified-context.dto';
import { UnclassifiedQueryDto } from './dto/unclassified-query.dto';

@ApiTags('온톨로지')
@ApiBearerAuth('access-token')
@ApiExtraModels(HttpErrorResponseDto)
@UseGuards(JwtAuthGuard)
@Controller('ontology')
export class OntologyController {
  constructor(
    private readonly runService: OntologyRunService,
    private readonly adminService: OntologyAdminService,
  ) {}

  @Get('snapshot')
  @ApiOperation({
    summary: 'Ontology snapshot 조회',
    description: 'OClass 트리 및 seedVersion, conceptType 목록을 반환합니다.',
  })
  @ApiOkResponse({ type: OntologySnapshotResponseDto })
  async getSnapshot() {
    return this.adminService.getSnapshot();
  }

  @Get('unclassified')
  @ApiOperation({
    summary: '미분류 Event/Concept 목록 조회',
    description:
      'Event 단위로 반환하며, 미분류 mention만 포함합니다.',
  })
  @ApiOkResponse({ type: [UnclassifiedContextDto] })
  async getUnclassified(@Query() dto: UnclassifiedQueryDto) {
    return this.adminService.getUnclassifiedContexts(dto);
  }

  @Post('runs')
  @ApiOperation({ summary: 'Ontology run 생성' })
  @ApiOkResponse({ type: OntologyRun })
  async createRun(@Body() dto: CreateOntologyRunDto): Promise<OntologyRun> {
    return this.runService.createRun(dto);
  }

  @Get('runs')
  @ApiOperation({ summary: 'Ontology run 목록 조회' })
  @ApiOkResponse({ type: [OntologyRun] })
  async listRuns(@Query() dto: ListOntologyRunsDto): Promise<OntologyRun[]> {
    return this.runService.listRuns(dto);
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Ontology run 단건 조회' })
  @ApiOkResponse({ type: OntologyRun })
  async getRun(@Param('id') id: string): Promise<OntologyRun> {
    return this.runService.getRun(id);
  }

  @Patch('runs/:id/confirm')
  @ApiOperation({ summary: 'Ontology run confirm 저장' })
  @ApiOkResponse({ type: OntologyRun })
  async confirmRun(
    @Param('id') id: string,
    @Body() dto: ConfirmOntologyRunDto,
  ): Promise<OntologyRun> {
    return this.runService.confirmRun(id, dto);
  }

  @Post('runs/:id/apply')
  @ApiOperation({ summary: 'Ontology run apply 실행' })
  @ApiOkResponse({ type: OntologyRun })
  async applyRun(
    @Param('id') id: string,
    @Body() dto: ApplyOntologyRunDto,
  ): Promise<OntologyRun> {
    return this.runService.applyRun(id, dto);
  }
}
