import { Controller, Get, Query } from '@nestjs/common';
import { ClassListQueryDto } from './dto/class-list-query.dto';
import { ClassesService } from './classes.service';

@Controller('public/classes')
export class ClassesPublicController {
  constructor(private readonly classesService: ClassesService) {}

  @Get('list')
  getPublicClasses(@Query() query: ClassListQueryDto) {
    return this.classesService.getPublicClasses(query);
  }
}
