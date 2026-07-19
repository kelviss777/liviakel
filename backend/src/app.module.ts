import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import { validateEnvironment } from './config/environment.validation';
import supabaseConfig from './config/supabase.config';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { SupabaseModule } from './infrastructure/supabase/supabase.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { GuestsModule } from './modules/guests/guests.module';
import { HealthModule } from './modules/health/health.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MembersModule } from './modules/members/members.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { VenuesModule } from './modules/venues/venues.module';
import { WeddingsModule } from './modules/weddings/weddings.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, supabaseConfig],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
    SupabaseModule,
    LoggingModule,
    HealthModule,
    AuthModule,
    MembersModule,
    WeddingsModule,
    GuestsModule,
    VenuesModule,
    TasksModule,
    ExpensesModule,
    DashboardModule,
    InvitationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
