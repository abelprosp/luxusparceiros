import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditModule } from '@/modules/audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LoginThrottleService } from './login-throttle.service';
import { JWT_ALGORITHM, jwtAudience, jwtIssuer } from '@/common/utils/jwt-options';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
          algorithm: JWT_ALGORITHM,
          issuer: jwtIssuer(config),
          audience: jwtAudience(config),
        },
        verifyOptions: {
          algorithms: [JWT_ALGORITHM],
          issuer: jwtIssuer(config),
          audience: jwtAudience(config),
        },
      }),
    }),
    forwardRef(() => AuditModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LoginThrottleService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
