import { StatusLogService } from './StatusLogService';

/**
 * Service registry to avoid circular dependencies
 * Services are registered here and can be accessed from event handlers
 */
class ServiceRegistry {
  private statusLogService: StatusLogService | null = null;

  public setStatusLogService(service: StatusLogService): void {
    this.statusLogService = service;
  }

  public getStatusLogService(): StatusLogService | null {
    return this.statusLogService;
  }
}

export const serviceRegistry = new ServiceRegistry();
