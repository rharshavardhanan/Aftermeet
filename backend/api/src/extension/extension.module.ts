import { Module } from '@nestjs/common';
import { ExtensionController } from './extension.controller';
import { ExtensionService } from './extension.service';
import { MeetingsModule } from '../meetings/meetings.module';

@Module({
  imports: [MeetingsModule],
  controllers: [ExtensionController],
  providers: [ExtensionService],
})
export class ExtensionModule {}
