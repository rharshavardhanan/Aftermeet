import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  onboardingCompleted: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        onboardingCompleted: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
