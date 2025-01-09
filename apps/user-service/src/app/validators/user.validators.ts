import { Injectable } from '@nestjs/common';
// import { CreateUserDto } from '../dto/user.dto';

@Injectable()
export class UserValidator {
  validateAge(dateOfBirth: Date): boolean {
    const age = this.calculateAge(dateOfBirth);
    return age >= 18;
  }

  validatePassword(password: string): boolean {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  }

  validatePhoneNumber(phoneNumber: string, countryCode: string): boolean {
    const phonePatterns = {
      AO: /^(?:\+244|244)?[9][1-9]\d{7}$/,
      CG: /^(?:\+242|242)?[0][5-9]\d{7}$/,
      // Add more country patterns as needed
    };

    return phonePatterns[countryCode]?.test(phoneNumber) ?? false;
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
}
