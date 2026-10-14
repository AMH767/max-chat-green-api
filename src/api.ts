export interface GreenApiConfig {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export interface IncomingNotification {
  receiptId?: number | string;
  body?: {
    typeWebhook?: string;
    idMessage?: string;
    timestamp?: number;
    senderData?: {
      chatId?: string;
      chatName?: string;
      senderName?: string;
      senderPhoneNumber?: number | string;
    };
    messageData?: {
      typeMessage?: string;
      textMessageData?: { textMessage?: string };
    };
  };
}

export interface ApiMessage {
  idMessage?: string;
  chatId?: string;
  message?: string;
  timestamp?: number;
}

export class GreenApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'GreenApiError';
  }
}

function basePath(config: GreenApiConfig): string {
  const apiUrl = config.apiUrl.trim().replace(/\/+$/, '');
  const id = encodeURIComponent(config.idInstance.trim());
  return `${apiUrl}/waInstance${id}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new GreenApiError('Не удалось подключиться к GREEN-API. Проверьте адрес API и соединение.');
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const details = typeof data === 'string'
      ? data
      : data && typeof data === 'object'
        ? JSON.stringify(data)
        : response.statusText;
    throw new GreenApiError(`GREEN-API: ${details || 'ошибка запроса'}`, response.status);
  }

  return data as T | null;
}

export function createGreenApi(config: GreenApiConfig) {
  const root = basePath(config);
  const token = encodeURIComponent(config.apiTokenInstance.trim());

  return {
    async getStateInstance(): Promise<{ stateInstance?: string }> {
      const result = await request<{ stateInstance?: string }>(`${root}/getStateInstance/${token}`);
      return result ?? {};
    },

    async checkAccount(phoneNumber: string): Promise<{ exist?: boolean; chatId?: string; status?: boolean; reason?: string }> {
      const result = await request<{ exist?: boolean; chatId?: string; status?: boolean; reason?: string }>(
        `${root}/checkAccount/${token}`,
        { method: 'POST', body: JSON.stringify({ phoneNumber: Number(phoneNumber) }) },
      );
      if (!result) throw new GreenApiError('GREEN-API вернул пустой ответ при проверке номера.');
      return result;
    },

    async sendMessage(chatId: string, message: string): Promise<{ idMessage?: string }> {
      const result = await request<{ idMessage?: string }>(`${root}/sendMessage/${token}`, {
        method: 'POST',
        body: JSON.stringify({ chatId, message }),
      });
      return result ?? {};
    },

    receiveNotification(signal?: AbortSignal): Promise<IncomingNotification | null> {
      return request<IncomingNotification>(`${root}/receiveNotification/${token}?receiveTimeout=5`, {
        method: 'GET',
        signal,
      });
    },

    async deleteNotification(receiptId: number | string): Promise<void> {
      await request(`${root}/deleteNotification/${token}/${encodeURIComponent(String(receiptId))}`, {
        method: 'DELETE',
      });
    },
  };
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function isSupportedPhone(phone: string): boolean {
  return /^7\d{10}$/.test(phone) || /^375\d{9}$/.test(phone);
}
