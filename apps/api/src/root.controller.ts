import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';

@Controller()
export class RootController {
  @Public()
  @Get()
  root() {
    return {
      name: 'Luxus Parceiros API',
      version: '1.0',
      health: '/api/health',
      docs: '/api/docs',
      login: '/api/auth/login',
    };
  }
}
