import apiClient from "../../services/axios";
import { ApiEndpoints } from "../../services/apiEndpoints";
import type { SimpleTripTemplate } from "./pdf";

export async function fetchTripConfirmationTemplate(): Promise<SimpleTripTemplate | null> {
  const res = await apiClient.get(ApiEndpoints.ownerTripConfirmationTemplate);
  const raw: any = res.data ?? {};
  const data = raw.data ?? raw;
  if (!data || typeof data !== "object") return null;
  const payload =
    "template" in data && data.template && typeof data.template === "object"
      ? data.template
      : data;
  if (Array.isArray((payload as { blocks?: unknown }).blocks)) return null;
  if (typeof (payload as SimpleTripTemplate).companyName !== "string") {
    return null;
  }
  return payload as SimpleTripTemplate;
}

export async function saveTripConfirmationTemplateRemote(
  template: SimpleTripTemplate,
): Promise<void> {
  await apiClient.put(ApiEndpoints.ownerTripConfirmationTemplate, {
    template,
  });
}
