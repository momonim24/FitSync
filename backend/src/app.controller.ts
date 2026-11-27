import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly dataSource: DataSource) {}

  /** Public health check: confirms the API is running and MySQL is reachable. */
  @Public()
  @Get('health')
  async health() {
    let database = 'up';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      database = 'down';
    }
    return { status: 'ok', service: 'FitSync API', version: 'v1', database, timestamp: new Date().toISOString() };
  }
}
