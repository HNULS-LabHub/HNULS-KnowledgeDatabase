import { logger } from './logger-service'

/**
 * 服务实例追踪器
 *
 * 用于诊断依赖注入问题：
 * - 检测同一服务的多实例创建
 * - 追踪依赖注入状态
 * - 验证服务调用时依赖是否可用
 */

interface ServiceInfo {
  serviceName: string
  instanceId: string
  createdAt: Date
  dependencies: Map<string, DependencyInfo>
}

interface DependencyInfo {
  name: string
  injectedAt?: Date
  instanceId?: string
  isConnected?: boolean
}

// 全局服务注册表
const serviceRegistry = new Map<string, ServiceInfo[]>()

/**
 * 生成短唯一 ID
 */
function generateInstanceId(): string {
  return Math.random().toString(36).substring(2, 8)
}

/**
 * 服务追踪装饰器/工具类
 */
export class ServiceTracker {
  private serviceInfo: ServiceInfo

  constructor(serviceName: string) {
    const instanceId = generateInstanceId()

    this.serviceInfo = {
      serviceName,
      instanceId,
      createdAt: new Date(),
      dependencies: new Map()
    }

    // 注册到全局
    if (!serviceRegistry.has(serviceName)) {
      serviceRegistry.set(serviceName, [])
    }
    const instances = serviceRegistry.get(serviceName)!
    instances.push(this.serviceInfo)

    // 检测多实例
    if (instances.length > 1) {
      logger.warn(`⚠️ [ServiceTracker] Multiple instances detected for ${serviceName}`, {
        totalInstances: instances.length,
        instances: instances.map((i) => ({
          instanceId: i.instanceId,
          createdAt: i.createdAt.toISOString()
        }))
      })
    } else {
      logger.debug(`[ServiceTracker] ${serviceName} created`, {
        instanceId
      })
    }
  }

  /**
   * 获取实例 ID
   */
  getInstanceId(): string {
    return this.serviceInfo.instanceId
  }

  /**
   * 记录依赖注入
   */
  trackDependencyInjection(
    dependencyName: string,
    dependency: { getInstanceId?: () => string; isConnected?: () => boolean } | null | undefined
  ): void {
    const depInfo: DependencyInfo = {
      name: dependencyName,
      injectedAt: new Date(),
      instanceId: dependency?.getInstanceId?.(),
      isConnected: dependency?.isConnected?.()
    }

    this.serviceInfo.dependencies.set(dependencyName, depInfo)

    if (dependency) {
      logger.info(
        `✅ [ServiceTracker] ${this.serviceInfo.serviceName}[${this.serviceInfo.instanceId}] <- ${dependencyName} injected`,
        {
          dependencyInstanceId: depInfo.instanceId,
          isConnected: depInfo.isConnected
        }
      )
    } else {
      logger.error(
        `❌ [ServiceTracker] ${this.serviceInfo.serviceName}[${this.serviceInfo.instanceId}] <- ${dependencyName} injection FAILED (null/undefined)`
      )
    }
  }

  /**
   * 在方法调用前检查依赖
   * 返回 true 表示依赖可用，false 表示缺失
   */
  checkDependency(
    dependencyName: string,
    dependency: { isConnected?: () => boolean } | null | undefined,
    methodName: string
  ): boolean {
    const available = !!dependency
    const connected = dependency?.isConnected?.() ?? false

    if (!available) {
      logger.error(
        `❌ [ServiceTracker] ${this.serviceInfo.serviceName}[${this.serviceInfo.instanceId}].${methodName}() - ${dependencyName} NOT AVAILABLE`,
        {
          injectionRecord: this.serviceInfo.dependencies.get(dependencyName) || 'never injected'
        }
      )
      return false
    }

    if (!connected) {
      logger.warn(
        `⚠️ [ServiceTracker] ${this.serviceInfo.serviceName}[${this.serviceInfo.instanceId}].${methodName}() - ${dependencyName} available but NOT CONNECTED`
      )
    }

    return available
  }

  /**
   * 获取诊断信息
   */
  getDiagnostics(): object {
    return {
      serviceName: this.serviceInfo.serviceName,
      instanceId: this.serviceInfo.instanceId,
      createdAt: this.serviceInfo.createdAt.toISOString(),
      dependencies: Object.fromEntries(
        Array.from(this.serviceInfo.dependencies.entries()).map(([k, v]) => [
          k,
          {
            ...v,
            injectedAt: v.injectedAt?.toISOString()
          }
        ])
      )
    }
  }
}

/**
 * 获取所有服务的诊断信息
 */
export function getAllServiceDiagnostics(): object {
  const diagnostics: Record<string, object[]> = {}

  for (const [serviceName, instances] of serviceRegistry) {
    diagnostics[serviceName] = instances.map((info) => ({
      instanceId: info.instanceId,
      createdAt: info.createdAt.toISOString(),
      dependencies: Object.fromEntries(
        Array.from(info.dependencies.entries()).map(([k, v]) => [
          k,
          {
            ...v,
            injectedAt: v.injectedAt?.toISOString()
          }
        ])
      )
    }))
  }

  return diagnostics
}

/**
 * 打印服务诊断报告
 */
export function logServiceDiagnostics(): void {
  const diagnostics = getAllServiceDiagnostics()
  logger.info('📊 [ServiceTracker] Service Diagnostics Report', diagnostics)

  // 检查问题
  for (const [serviceName, instances] of Object.entries(diagnostics)) {
    if ((instances as object[]).length > 1) {
      logger.warn(`⚠️ [ServiceTracker] ${serviceName} has ${(instances as object[]).length} instances!`)
    }
  }
}
