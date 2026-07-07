import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { MESSAGES } from '@/common/constants/messages';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        permissions: { include: { permission: true } },
        partner: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(MESSAGES.UNAUTHORIZED);
    }

    if (user.partner?.status === 'SUSPENDED') {
      throw new UnauthorizedException(MESSAGES.PARTNER_SUSPENDED);
    }

    const customPermissions = user.permissions.map((p) => p.permission.name);
    const permissions = [...new Set([...payload.permissions, ...customPermissions])];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      partnerId: user.partnerId ?? undefined,
      permissions,
    };
  }
}
