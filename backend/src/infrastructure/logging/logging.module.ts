import { Module } from '@nestjs/common';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

@Module({ providers: [LoggingInterceptor], exports: [LoggingInterceptor] })
export class LoggingModule {}
