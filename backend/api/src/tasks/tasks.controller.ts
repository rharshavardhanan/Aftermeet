import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { TasksService } from './tasks.service';
import { SetDoneDto, UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tasks.list(user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(id, user.id, dto);
  }

  @Post(':id/done')
  setDone(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetDoneDto,
  ) {
    return this.tasks.setDone(id, user.id, dto.done);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.archive(id, user.id);
  }
}
