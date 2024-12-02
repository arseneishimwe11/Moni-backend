import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  password: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  twoFactorCode?: string;
}

export class BiometricLoginDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9-_]+$/)
  biometricToken: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class Enable2FADto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class Verify2FADto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class BiometricChallengeDto {
  @IsString()
  @IsNotEmpty()
  response: string;
}
