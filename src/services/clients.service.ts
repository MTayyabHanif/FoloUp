import { createClient } from "@supabase/supabase-js";

import type { Organization } from "@/types/organization";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const updateOrganization = async (payload: Partial<Organization>, id: string) => {
  const { data, error } = await supabase
    .from("organization")
    .update({ ...payload })
    .eq("id", id);

  if (error) {
    throw new Error(`updateOrganization failed: ${error.message}`);
  }

  return data;
};

const getClientById = async (
  id: string,
  email?: string | null,
  organization_id?: string | null,
) => {
  const { data, error } = await supabase
    .from("user")
    .select(`*`)
    .filter("id", "eq", id);

  if (error) {
    throw new Error(`getClientById fetch failed: ${error.message}`);
  }

  // First sign-in for this user: insert.
  if ((!data || data.length === 0) && email) {
    const { data: inserted, error: insertError } = await supabase
      .from("user")
      .insert({ id, email, organization_id });

    if (insertError) {
      throw new Error(`getClientById insert failed: ${insertError.message}`);
    }

    return inserted?.[0] ?? null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Existing user changed orgs in Clerk: update.
  if (data[0].organization_id !== organization_id) {
    const { data: updated, error: updateError } = await supabase
      .from("user")
      .update({ organization_id })
      .eq("id", id);

    if (updateError) {
      throw new Error(`getClientById update failed: ${updateError.message}`);
    }

    return updated?.[0] ?? null;
  }

  return data[0];
};

const getOrganizationById = async (
  organization_id?: string,
  organization_name?: string,
) => {
  const { data, error } = await supabase
    .from("organization")
    .select(`*`)
    .filter("id", "eq", organization_id);

  if (error) {
    throw new Error(`getOrganizationById fetch failed: ${error.message}`);
  }

  // First time we've seen this org from Clerk: upsert it.
  if (!data || data.length === 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("organization")
      .insert({ id: organization_id, name: organization_name });

    if (insertError) {
      throw new Error(
        `getOrganizationById insert failed: ${insertError.message}`,
      );
    }

    return inserted?.[0] ?? null;
  }

  // Name drift: keep ours in sync with Clerk.
  if (organization_name && data[0].name !== organization_name) {
    const { data: updated, error: updateError } = await supabase
      .from("organization")
      .update({ name: organization_name })
      .eq("id", organization_id);

    if (updateError) {
      throw new Error(
        `getOrganizationById name-sync failed: ${updateError.message}`,
      );
    }

    return updated?.[0] ?? null;
  }

  return data[0];
};

export const ClientService = {
  updateOrganization,
  getClientById,
  getOrganizationById,
};
