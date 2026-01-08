import { db } from "../db";
import { telnyxPortingOrders, companies, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCompanyTelnyxApiToken } from "./wallet-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

/**
 * CRITICAL: All Telnyx operations MUST use managed account API key.
 * Never fall back to master key - each company has their own Telnyx managed account.
 */
async function getRequiredCompanyTelnyxApiKey(companyId: string): Promise<string> {
  const apiKey = await getCompanyTelnyxApiToken(companyId);
  if (!apiKey) {
    throw new Error("Company Telnyx account not configured. Please set up your Telnyx managed account first.");
  }
  return apiKey.trim().replace(/[\r\n\t]/g, '');
}

export interface PortabilityCheckResult {
  record_type: string;
  phone_number: string;
  portable: boolean;
  fast_portable: boolean;
  not_portable_reason: string | null;
  carrier_name: string;
  phone_number_type: string;
  messaging_capable?: boolean;
}

export interface PortabilityCheckResponse {
  success: boolean;
  results?: PortabilityCheckResult[];
  error?: string;
}

export async function checkPortability(
  phoneNumbers: string[],
  companyId: string
): Promise<PortabilityCheckResponse> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    console.log(`[Telnyx Porting] Checking portability for ${phoneNumbers.length} numbers using managed account`);

    const response = await fetch(`${TELNYX_API_BASE}/portability_checks`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ phone_numbers: phoneNumbers }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Porting] Portability check error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to check portability: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    console.log(`[Telnyx Porting] Portability check complete:`, result.data);

    return {
      success: true,
      results: result.data,
    };
  } catch (error) {
    console.error("[Telnyx Porting] Portability check error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check portability",
    };
  }
}

export interface CreatePortingOrderParams {
  phone_numbers: string[];
  user_reference?: string;
  webhook_url?: string;
}

export interface TelnyxPortingOrderData {
  id: string;
  record_type: string;
  status: string;
  phone_numbers: string[];
  requirements: any[];
  requirements_status: boolean;
  created_at: string;
  updated_at: string;
  foc_datetime_requested?: string;
  foc_datetime_actual?: string;
  end_user?: any;
  misc?: any;
  activation_settings?: any;
  phone_number_configuration?: any;
  documents?: any;
}

export interface CreatePortingOrderResponse {
  success: boolean;
  portingOrders?: TelnyxPortingOrderData[];
  error?: string;
}

export async function createPortingOrder(
  params: CreatePortingOrderParams,
  companyId: string
): Promise<CreatePortingOrderResponse> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    console.log(`[Telnyx Porting] Creating porting order for ${params.phone_numbers.length} numbers using managed account`);

    const response = await fetch(`${TELNYX_API_BASE}/porting_orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Porting] Create order error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to create porting order: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    console.log(`[Telnyx Porting] Porting order(s) created:`, result.data);

    const orders = Array.isArray(result.data) ? result.data : [result.data];
    return {
      success: true,
      portingOrders: orders,
    };
  } catch (error) {
    console.error("[Telnyx Porting] Create order error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create porting order",
    };
  }
}

export interface GetPortingOrderResponse {
  success: boolean;
  portingOrder?: TelnyxPortingOrderData;
  error?: string;
}

export async function getPortingOrder(
  portingOrderId: string,
  companyId: string
): Promise<GetPortingOrderResponse> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    console.log(`[Telnyx Porting] Getting porting order: ${portingOrderId} using managed account`);

    const response = await fetch(`${TELNYX_API_BASE}/porting_orders/${portingOrderId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Porting] Get order error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to get porting order: ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      portingOrder: result.data,
    };
  } catch (error) {
    console.error("[Telnyx Porting] Get order error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get porting order",
    };
  }
}

export interface AllowedFocWindow {
  started_at: string;
  ended_at: string;
}

export interface GetAllowedFocDatesResponse {
  success: boolean;
  focWindows?: AllowedFocWindow[];
  error?: string;
}

export async function getAllowedFocDates(
  portingOrderId: string,
  companyId: string
): Promise<GetAllowedFocDatesResponse> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    console.log(`[Telnyx Porting] Getting allowed FOC dates for order: ${portingOrderId} using managed account`);

    const response = await fetch(`${TELNYX_API_BASE}/porting_orders/${portingOrderId}/allowed_foc_windows`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Porting] Get FOC dates error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to get allowed FOC dates: ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      focWindows: result.data,
    };
  } catch (error) {
    console.error("[Telnyx Porting] Get FOC dates error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get allowed FOC dates",
    };
  }
}

export interface UpdatePortingOrderParams {
  misc?: {
    type?: "full" | "partial";
    remaining_numbers_action?: string | null;
    new_billing_phone_number?: string | null;
  };
  end_user?: {
    admin?: {
      entity_name?: string;
      auth_person_name?: string;
      billing_phone_number?: string;
      account_number?: string;
      tax_identifier?: string;
      pin_passcode?: string;
      business_identifier?: string;
    };
    location?: {
      street_address?: string;
      extended_address?: string;
      locality?: string;
      administrative_area?: string;
      postal_code?: string;
      country_code?: string;
    };
  };
  activation_settings?: {
    foc_datetime_requested?: string;
    activation_status?: string;
  };
  phone_number_configuration?: {
    connection_id?: string;
    messaging_profile_id?: string;
    emergency_address_id?: string;
    tags?: string[];
  };
  documents?: {
    loa?: string;
    invoice?: string;
  };
  requirements?: Array<{
    requirement_type_id: string;
    field_value: string;
  }>;
  webhook_url?: string;
  user_reference?: string;
}

export interface UpdatePortingOrderResponse {
  success: boolean;
  portingOrder?: TelnyxPortingOrderData;
  error?: string;
  validationErrors?: any[];
}

export async function updatePortingOrder(
  portingOrderId: string,
  params: UpdatePortingOrderParams,
  companyId: string
): Promise<UpdatePortingOrderResponse> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    console.log(`[Telnyx Porting] Updating porting order: ${portingOrderId} using managed account`, params);

    const response = await fetch(`${TELNYX_API_BASE}/porting_orders/${portingOrderId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Telnyx Porting] Update order error: ${response.status}`, errorData);
      return {
        success: false,
        error: `Failed to update porting order: ${response.status}`,
        validationErrors: errorData.errors,
      };
    }

    const result = await response.json();
    return {
      success: true,
      portingOrder: result.data,
    };
  } catch (error) {
    console.error("[Telnyx Porting] Update order error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update porting order",
    };
  }
}

export interface SubmitPortingOrderResponse {
  success: boolean;
  portingOrder?: TelnyxPortingOrderData;
  error?: string;
}

export async function submitPortingOrder(
  portingOrderId: string,
  companyId: string
): Promise<SubmitPortingOrderResponse> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    console.log(`[Telnyx Porting] Submitting porting order: ${portingOrderId} using managed account`);

    const response = await fetch(`${TELNYX_API_BASE}/porting_orders/${portingOrderId}/actions/confirm`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Porting] Submit order error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to submit porting order: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    console.log(`[Telnyx Porting] Porting order submitted successfully`);
    return {
      success: true,
      portingOrder: result.data,
    };
  } catch (error) {
    console.error("[Telnyx Porting] Submit order error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit porting order",
    };
  }
}

export interface CancelPortingOrderResponse {
  success: boolean;
  error?: string;
}

export async function cancelPortingOrder(
  portingOrderId: string,
  companyId: string
): Promise<CancelPortingOrderResponse> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    console.log(`[Telnyx Porting] Cancelling porting order: ${portingOrderId} using managed account`);

    const response = await fetch(`${TELNYX_API_BASE}/porting_orders/${portingOrderId}/actions/cancel`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Porting] Cancel order error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to cancel porting order: ${response.status} - ${errorText}`,
      };
    }

    console.log(`[Telnyx Porting] Porting order cancelled successfully`);
    return { success: true };
  } catch (error) {
    console.error("[Telnyx Porting] Cancel order error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel porting order",
    };
  }
}

export interface GetPortingRequirementsResponse {
  success: boolean;
  requirements?: any[];
  error?: string;
}

export async function getPortingRequirements(
  portingOrderId: string,
  companyId: string
): Promise<GetPortingRequirementsResponse> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    console.log(`[Telnyx Porting] Getting requirements for order: ${portingOrderId} using managed account`);

    const response = await fetch(`${TELNYX_API_BASE}/porting_orders/${portingOrderId}/requirements`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Porting] Get requirements error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to get requirements: ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      requirements: result.data,
    };
  } catch (error) {
    console.error("[Telnyx Porting] Get requirements error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get requirements",
    };
  }
}

export interface UploadDocumentResponse {
  success: boolean;
  documentId?: string;
  error?: string;
}

export async function uploadDocument(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  companyId: string
): Promise<UploadDocumentResponse> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    console.log(`[Telnyx Porting] Uploading document: ${fileName} using managed account`);

    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: mimeType,
    });

    const response = await fetch(`${TELNYX_API_BASE}/documents`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Porting] Upload document error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to upload document: ${response.status}`,
      };
    }

    const result = await response.json();
    console.log(`[Telnyx Porting] Document uploaded: ${result.data?.id}`);
    return {
      success: true,
      documentId: result.data?.id,
    };
  } catch (error) {
    console.error("[Telnyx Porting] Upload document error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload document",
    };
  }
}

export interface ListPortingOrdersParams {
  page?: number;
  pageSize?: number;
  status?: string;
}

export interface ListPortingOrdersResponse {
  success: boolean;
  portingOrders?: TelnyxPortingOrderData[];
  totalCount?: number;
  error?: string;
}

export async function listPortingOrders(
  params: ListPortingOrdersParams = {},
  companyId: string
): Promise<ListPortingOrdersResponse> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page[number]", String(params.page));
    if (params.pageSize) queryParams.append("page[size]", String(params.pageSize));
    if (params.status) queryParams.append("filter[status]", params.status);

    console.log(`[Telnyx Porting] Listing porting orders`);

    const response = await fetch(`${TELNYX_API_BASE}/porting_orders?${queryParams.toString()}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Porting] List orders error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to list porting orders: ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      portingOrders: result.data,
      totalCount: result.meta?.total_results,
    };
  } catch (error) {
    console.error("[Telnyx Porting] List orders error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list porting orders",
    };
  }
}

export async function downloadLoaTemplate(
  portingOrderId: string,
  companyId: string
): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
  try {
    const apiKey = await getRequiredCompanyTelnyxApiKey(companyId);

    console.log(`[Telnyx Porting] Downloading LOA template for order: ${portingOrderId} using managed account`);

    const response = await fetch(`${TELNYX_API_BASE}/porting_orders/${portingOrderId}/loa_template`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/pdf",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Porting] Download LOA error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to download LOA template: ${response.status}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      success: true,
      pdfBuffer: Buffer.from(arrayBuffer),
    };
  } catch (error) {
    console.error("[Telnyx Porting] Download LOA error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to download LOA template",
    };
  }
}

export async function getCompanyPortingOrders(companyId: string) {
  return db
    .select()
    .from(telnyxPortingOrders)
    .where(eq(telnyxPortingOrders.companyId, companyId))
    .orderBy(desc(telnyxPortingOrders.createdAt));
}

export async function getPortingOrderById(orderId: string) {
  const [order] = await db
    .select()
    .from(telnyxPortingOrders)
    .where(eq(telnyxPortingOrders.id, orderId));
  return order;
}

export async function createLocalPortingOrder(data: {
  companyId: string;
  createdBy: string;
  phoneNumbers: string[];
  telnyxPortingOrderId?: string;
  status?: string;
  portabilityCheckResults?: any;
}) {
  const [order] = await db
    .insert(telnyxPortingOrders)
    .values({
      companyId: data.companyId,
      createdBy: data.createdBy,
      phoneNumbers: data.phoneNumbers,
      telnyxPortingOrderId: data.telnyxPortingOrderId,
      status: data.status || "draft",
      portabilityCheckResults: data.portabilityCheckResults,
    })
    .returning();
  return order;
}

export async function updateLocalPortingOrder(
  orderId: string,
  data: Partial<{
    telnyxPortingOrderId: string;
    status: string;
    portabilityCheckResults: any;
    currentCarrierName: string;
    currentCarrierAccountNumber: string;
    currentCarrierPin: string;
    endUserEntityName: string;
    endUserAuthPersonName: string;
    endUserBillingPhone: string;
    streetAddress: string;
    extendedAddress: string;
    locality: string;
    administrativeArea: string;
    postalCode: string;
    countryCode: string;
    loaDocumentId: string;
    invoiceDocumentId: string;
    focDatetimeRequested: Date;
    focDatetimeActual: Date;
    requirements: any;
    requirementsStatus: boolean;
    connectionId: string;
    messagingProfileId: string;
    lastError: string;
    submittedAt: Date;
    portedAt: Date;
    cancelledAt: Date;
  }>
) {
  const [order] = await db
    .update(telnyxPortingOrders)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(telnyxPortingOrders.id, orderId))
    .returning();
  return order;
}

export async function updateLocalPortingOrderByTelnyxId(
  telnyxPortingOrderId: string,
  data: Partial<{
    status: string;
    lastWebhookAt: Date;
    focDatetimeActual: Date;
    portedAt: Date;
    cancelledAt: Date;
    lastError: string;
  }>
) {
  const [order] = await db
    .update(telnyxPortingOrders)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(telnyxPortingOrders.telnyxPortingOrderId, telnyxPortingOrderId))
    .returning();
  return order;
}
