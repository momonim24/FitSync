import { Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ReportQueryDto } from './dto/report-query.dto';
import { adminReportCsv, memberReportCsv, trainerReportCsv } from './report-csv';
import { resolveRange } from './report-range';
import { ReportsService } from './reports.service';

/**
 * /api/v1/reports — fitness reports (Laboratory Activity 03 "fitness reports").
 * Query: ?period=week|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv
 * format=csv returns a downloadable, formula-injection-safe CSV file.
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  /** Member: own report. */
  @Roles(Role.Member)
  @Get('member')
  async member(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const report = await this.service.memberReport(user.userId, resolveRange(query));
    return query.format === 'csv' ? this.csv(res, `member-report-${report.range.from}_${report.range.to}`, memberReportCsv(report)) : report;
  }

  /** Trainer: comparison of all assigned members. */
  @Roles(Role.Trainer)
  @Get('trainer')
  async trainer(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const report = await this.service.trainerReport(user.userId, resolveRange(query));
    return query.format === 'csv' ? this.csv(res, `trainer-report-${report.range.from}_${report.range.to}`, trainerReportCsv(report)) : report;
  }

  /** Trainer: one assigned member's report (403 if not assigned). */
  @Roles(Role.Trainer)
  @Get('trainer/members/:memberId')
  async trainerMember(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const report = await this.service.trainerMemberReport(user.userId, memberId, resolveRange(query));
    return query.format === 'csv'
      ? this.csv(res, `member-${memberId}-report-${report.range.from}_${report.range.to}`, memberReportCsv(report))
      : report;
  }

  /** Admin: system-wide report. */
  @Roles(Role.Admin)
  @Get('admin')
  async admin(@Query() query: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    const report = await this.service.adminReport(resolveRange(query));
    return query.format === 'csv' ? this.csv(res, `system-report-${report.range.from}_${report.range.to}`, adminReportCsv(report)) : report;
  }

  private csv(res: Response, name: string, body: string): string {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="fitsync-${name.replace(/[^A-Za-z0-9_.-]/g, '')}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    return body;
  }
}
