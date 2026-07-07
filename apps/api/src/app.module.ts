import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '@/prisma/prisma.module';
import { GatewayModule } from '@/gateway/gateway.module';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { PrismaExceptionFilter } from '@/common/filters/prisma-exception.filter';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { PartnersModule } from '@/modules/partners/partners.module';
import { ClientsModule } from '@/modules/clients/clients.module';
import { OperatorsModule } from '@/modules/operators/operators.module';
import { PlansModule } from '@/modules/plans/plans.module';
import { LinesModule } from '@/modules/lines/lines.module';
import { SimCardsModule } from '@/modules/sim-cards/sim-cards.module';
import { SalesModule } from '@/modules/sales/sales.module';
import { CommissionsModule } from '@/modules/commissions/commissions.module';
import { RequestsModule } from '@/modules/requests/requests.module';
import { TicketsModule } from '@/modules/tickets/tickets.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { DashboardModule } from '@/modules/dashboard/dashboard.module';
import { CampaignsModule } from '@/modules/campaigns/campaigns.module';
import { FinancialModule } from '@/modules/financial/financial.module';
import { AuditModule } from '@/modules/audit/audit.module';
import { UploadsModule } from '@/modules/uploads/uploads.module';
import { StockModule } from '@/modules/stock/stock.module';
import { BranchesModule } from '@/modules/branches/branches.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),
    PrismaModule,
    GatewayModule,
    AuthModule,
    UsersModule,
    PartnersModule,
    ClientsModule,
    OperatorsModule,
    PlansModule,
    LinesModule,
    SimCardsModule,
    SalesModule,
    CommissionsModule,
    RequestsModule,
    TicketsModule,
    NotificationsModule,
    DashboardModule,
    CampaignsModule,
    FinancialModule,
    AuditModule,
    UploadsModule,
    StockModule,
    BranchesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
