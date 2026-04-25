import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HTTP as CerbosHttp } from '@cerbos/http';
import { CERBOS_CLIENT } from './cerbos.constants';

@Global()
@Module({
  providers: [
    {
      provide: CERBOS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<{ CERBOS_URL: string }>('app')?.CERBOS_URL ?? 'http://localhost:3593';
        return new CerbosHttp(url);
      },
    },
  ],
  exports: [CERBOS_CLIENT],
})
export class CerbosModule {}
