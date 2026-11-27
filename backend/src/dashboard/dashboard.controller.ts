import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { DashboardFitnessService } from './dashboard-fitness.service';
import { DashboardService } from './dashboard.service';

/** /api/v1/dashboard — read-only statistics for each role's dashboard. */
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly fitness: DashboardFitnessService,
  ) {}

  // Version 2.0 adds a `fitness` object to each response; every original field is unchanged.

  @Roles(Role.Member)
  @Get('member')
  async member(@CurrentUser() user: AuthUser) {
    const [base, fitness] = await Promise.all([this.service.member(user.userId), this.fitness.member(user.userId)]);
    return { ...base, fitness };
  }

  @Roles(Role.Trainer)
  @Get('trainer')
  async trainer(@CurrentUser() user: AuthUser) {
    const [base, fitness] = await Promise.all([this.service.trainer(user.userId), this.fitness.trainer(user.userId)]);
    return { ...base, fitness };
  }

  @Roles(Role.Admin)
  @Get('admin')
  async admin() {
    const [base, fitness] = await Promise.all([this.service.admin(), this.fitness.admin()]);
    return { ...base, fitness };
  }
}
