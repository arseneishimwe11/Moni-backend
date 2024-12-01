import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorators';
import { UserRepository } from '../repository/user.repository';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userRepository: UserRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      return false;
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      return false;
    }

    const hasRequiredRoles = requiredRoles.some(role => user.roles.includes(role));
    
    if (!hasRequiredRoles) {
      this.logUnauthorizedAccess(userId, requiredRoles, user.roles);
    }

    return hasRequiredRoles;
  }

  private logUnauthorizedAccess(userId: string, requiredRoles: string[], userRoles: string[]): void {
    const logger = new Logger(RolesGuard.name);
    logger.warn(`User ${userId} with roles [${userRoles}] attempted to access endpoint requiring roles [${requiredRoles}]`);
  }
}
