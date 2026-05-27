/** Shared agency name + phone formatting for owner UI. */

export type AgencyDisplayFields = {
  name?: string;
  phone?: string;
};

/** Single-line label: `Agency Name · 9876543210` */
export function formatAgencyLabel(agency: AgencyDisplayFields): string {
  const name = agency.name?.trim() || "Unnamed";
  const phone = agency.phone?.trim();
  return phone ? `${name} · ${phone}` : name;
}

export function buildAgencyLabelLookup(
  agencies: AgencyDisplayFields[],
): Map<string, string> {
  const byName = new Map<string, AgencyDisplayFields[]>();
  for (const agency of agencies) {
    const key = (agency.name ?? "").trim().toLowerCase();
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(agency);
    byName.set(key, list);
  }

  const lookup = new Map<string, string>();
  for (const [key, list] of byName) {
    if (list.length === 1) {
      lookup.set(key, formatAgencyLabel(list[0]));
    } else if (list.length > 1) {
      lookup.set(
        key,
        list.map((a) => formatAgencyLabel(a)).join(" · "),
      );
    } else {
      lookup.set(key, list[0]?.name?.trim() || key);
    }
  }
  return lookup;
}

/** Resolve trip `agencyName` string using owner agency list when possible. */
export function resolveAgencyLabelFromName(
  agencyName: string | undefined,
  agencies: AgencyDisplayFields[],
): string {
  const name = (agencyName ?? "").trim();
  if (!name) return "—";
  const lookup = buildAgencyLabelLookup(agencies);
  return lookup.get(name.toLowerCase()) ?? name;
}
