import { UnauthorizedException } from '@nestjs/common';

type RequestWithUser = {
  user?: { id?: string };
};

export const getUserIdOrThrow = (req: RequestWithUser): string => {
  const userId = req?.user?.id;
  if (!userId) {
    throw new UnauthorizedException('Invalid user context');
  }
  return userId;
};

export type { RequestWithUser };
