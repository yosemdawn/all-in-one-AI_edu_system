import request from "@/utils/request";

export interface AiModel {
  code: string;
  name: string;
  provider: string;
  modelName: string;
  baseUrl: string;
  apiKey?: string;
  accessKey?: string;
  secretKey?: string;
  status: "active" | "inactive";
  isDefault: boolean;
  totalUsage: number;
  totalTokens: number;
  lastUsedAt?: Date;
  lastBalance: number;
  balanceCurrency: string;
  lastBalanceCheck?: Date;
}

export interface ModelBalance {
  balance: number;
  currency: string;
  lastUpdated: Date;
  status: "success" | "error";
  message?: string;
  details?: {
    grantedBalance?: number;
    toppedUpBalance?: number;
    accountId?: number;
    cashBalance?: number;
    arrearsBalance?: number;
    freezeAmount?: number;
    creditLimit?: number;
  };
}

export interface AiModelListResponse {
  models: AiModel[];
  summary: {
    totalModels: number;
    activeModels: number;
    totalUsage: number;
    totalBalance: number;
  };
}

export interface ModelStats {
  dailyUsage: { date: string; count: number }[];
  monthlyUsage: { month: string; count: number }[];
  recentActivity: {
    assignmentId: string;
    assignmentTitle: string;
    usedAt: Date;
    tokenUsed: number;
  }[];
}

export interface ConnectionTestResult {
  success: boolean;
  responseTime: number;
  message: string;
}

export interface UpdateAiModelData {
  apiKey?: string;
  accessKey?: string;
  secretKey?: string;
  status?: "active" | "inactive";
  isDefault?: boolean;
}

export interface SetDefaultResult {
  success: boolean;
  message: string;
}

export const aiModelApi = {
  getList(): Promise<AiModelListResponse> {
    return request({
      url: "/admin/ai-models",
      method: "GET",
    });
  },

  getDetail(code: string): Promise<AiModel> {
    return request({
      url: `/admin/ai-models/${code}`,
      method: "GET",
    });
  },

  updateConfig(code: string, data: UpdateAiModelData): Promise<AiModel> {
    return request({
      url: `/admin/ai-models/${code}`,
      method: "PUT",
      data,
    });
  },

  setDefault(code: string): Promise<SetDefaultResult> {
    return request({
      url: `/admin/ai-models/${code}/default`,
      method: "POST",
    });
  },

  getBalance(code: string): Promise<ModelBalance> {
    return request({
      url: `/admin/ai-models/${code}/balance`,
      method: "GET",
    });
  },

  testConnection(code: string): Promise<ConnectionTestResult> {
    return request({
      url: `/admin/ai-models/${code}/test`,
      method: "POST",
    });
  },

  getStats(code: string): Promise<ModelStats> {
    return request({
      url: `/admin/ai-models/${code}/stats`,
      method: "GET",
    });
  },

  getActiveModels(): Promise<AiModel[]> {
    return request({
      url: "/v1/ai-models/active",
      method: "GET",
    });
  },

  initializeModels(): Promise<{ success: boolean; message: string }> {
    return request({
      url: "/admin/ai-models/initialize",
      method: "POST",
    });
  },
};

export default aiModelApi;
