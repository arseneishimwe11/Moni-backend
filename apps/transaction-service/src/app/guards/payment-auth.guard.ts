import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { StripeCurrency } from '../dto/payment.dto';

@Injectable()
export class PaymentAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.get('authorization'); // Use method to access headers

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization format');
    }    

    const apiKey = this.configService.get<string>('API_KEY');
    if (!apiKey) { 
      throw new UnauthorizedException('API key not configured');
    }

    if (token !== apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Payment-specific validations
    const { amount, currency } = request.body;

    if (typeof amount !== 'number' || amount <= 0) { 
      throw new UnauthorizedException('Invalid payment amount');
    }

    if (!Object.values(StripeCurrency).includes(currency)) {
      throw new UnauthorizedException('Unsupported currency');
    }

    return true;
  }
}