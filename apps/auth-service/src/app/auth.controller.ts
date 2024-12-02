import {
  Controller,
  Post,
  Body,
  UseGuards,
  Headers,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { TwoFactorService } from './services/two-factor.service';
import { BiometricService } from './services/biometric.service';
import { AuthGuard } from './guards/auth.guard';
import { RequestWithUser } from './interfaces/request-with-user.interface';
import {
  LoginDto,
  BiometricLoginDto,
  RefreshTokenDto,
  Enable2FADto,
  Verify2FADto,
  BiometricChallengeDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly biometricService: BiometricService
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Headers('user-agent') userAgent: string,
    @Req() request: RequestWithUser
  ) {
    const ipAddress = request.ip || request.connection.remoteAddress;
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Post('biometric/login')
  async biometricLogin(
    @Body() loginDto: BiometricLoginDto,
    @Headers('user-agent') userAgent: string,
    @Req() request: RequestWithUser
  ) {
    const ipAddress = request.ip || request.connection.remoteAddress;
    return this.authService.biometricLogin(loginDto, ipAddress, userAgent);
  }

  @Post('refresh')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Req() request: RequestWithUser) {
    const authHeader = request.headers['authorization'];
    if (typeof authHeader !== 'string') {
      throw new UnauthorizedException('Invalid authorization header');
    }
    const token = authHeader.split(' ')[1];
    return this.authService.logout(request.user.sub, token);
  }

  @Post('2fa/enable')
  @UseGuards(AuthGuard)
  async enable2FA(
    @Req() request: RequestWithUser,
    @Body() enable2FADto: Enable2FADto
  ) {
    const { qrCode } = await this.twoFactorService.generateSecret(
      request.user.sub,
      request.user.email
    );

    const isValid = await this.twoFactorService.verifyCode(
      request.user.sub,
      enable2FADto.code
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
    const backupCodes = await this.twoFactorService.generateBackupCodes(
      request.user.sub
    );

    return { qrCode, backupCodes };
  }
  @Post('2fa/verify')
  @UseGuards(AuthGuard)
  async verify2FA(
    @Req() request: RequestWithUser,
    @Body() verify2FADto: Verify2FADto
  ) {
    const isValid = await this.twoFactorService.verifyCode(
      request.user.sub,
      verify2FADto.code
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    return { verified: true };
  }

  @Post('biometric/challenge')
  @UseGuards(AuthGuard)
  async getBiometricChallenge(@Req() request: RequestWithUser) {
    return this.biometricService.generateBiometricChallenge(request.user.sub);
  }

  @Post('biometric/verify')
  @UseGuards(AuthGuard)
  async verifyBiometricChallenge(
    @Req() request: RequestWithUser,
    @Body() challengeDto: BiometricChallengeDto
  ) {
    const isValid = await this.biometricService.verifyBiometricChallenge(
      request.user.sub,
      challengeDto.response
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid biometric verification');
    }

    return { verified: true };
  }
}
