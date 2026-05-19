"use client";

import React, { useState, useContext, ReactNode, useEffect } from "react";
import { User } from "@/types/user";
import { useClerk, useOrganization } from "@clerk/nextjs";
import { ClientService } from "@/services/clients.service";

interface ClientContextProps {
  client?: User;
}

export const ClientContext = React.createContext<ClientContextProps>({
  client: undefined,
});

interface ClientProviderProps {
  children: ReactNode;
}

export function ClientProvider({ children }: ClientProviderProps) {
  const [client, setClient] = useState<User>();
  const { user } = useClerk();
  const { organization } = useOrganization();

  const [clientLoading, setClientLoading] = useState(true);

  const fetchClient = async () => {
    try {
      setClientLoading(true);
      const response = await ClientService.getClientById(
        user?.id as string,
        user?.emailAddresses[0]?.emailAddress as string,
        organization?.id as string,
      );
      setClient(response);
    } catch (error) {
      console.error(error);
    }
    setClientLoading(false);
  };

  const fetchOrganization = async () => {
    try {
      setClientLoading(true);
      const response = await ClientService.getOrganizationById(
        organization?.id as string,
        organization?.name as string,
      );
    } catch (error) {
      console.error(error);
    }
    setClientLoading(false);
  };

  // Single ordered effect: the user row's organization_id FKs to
  // organization(id), so the org must be upserted FIRST. Previously these
  // ran as two independent effects and raced — the user INSERT could fire
  // before the org INSERT committed, producing a FK violation on the
  // very first sign-in for a new (user, org) pair.
  useEffect(() => {
    if (!user?.id) {
      return;
    }
    (async () => {
      if (organization?.id) {
        await fetchOrganization();
      }
      await fetchClient();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, organization?.id]);

  return (
    <ClientContext.Provider
      value={{
        client,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export const useClient = () => {
  const value = useContext(ClientContext);

  return value;
};
