import { ConfigService } from '@nestjs/config';

export const JWT_ALGORITHM = 'HS256' as const;

export function jwtIssuer(config: ConfigService): string {
  return config.get<string>('JWT_ISSUER') || 'luxus-parceiros-api';
}

export function jwtAudience(config: ConfigService): string {
  return config.get<string>('JWT_AUDIENCE') || 'luxus-parceiros';
}

export function jwtVerifyOptions(config: ConfigService) {
  return {
    secret: config.getOrThrow<string>('JWT_SECRET'),
    algorithms: [JWT_ALGORITHM],
    issuer: jwtIssuer(config),
    audience: jwtAudience(config),
  };
}
