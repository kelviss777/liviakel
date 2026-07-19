import { Global, Module } from '@nestjs/common';
import { MembersRepository } from './members.repository';
import { WeddingContextService } from './wedding-context.service';

@Global()
@Module({
  providers: [MembersRepository, WeddingContextService],
  exports: [WeddingContextService],
})
export class MembersModule {}
