import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentUser() user: AuthUser) {
    return this.billing.checkout(user.id, user.email ?? undefined);
  }

  // Stripe calls this (no JWT). Verified by the Stripe signature over the raw body.
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    if (!sig) throw new BadRequestException('Missing signature');
    if (!req.rawBody) throw new BadRequestException('Missing raw body');
    return this.billing.handleWebhook(req.rawBody, sig);
  }
}
