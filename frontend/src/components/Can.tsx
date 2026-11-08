import type { ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { hasPermission } from "../utils/permissions";

interface CanProps {
  I: string;
  children: ReactNode;
}

export const Can = ({ I, children }: CanProps) => {
  const auth = useAuth();
  return hasPermission(auth.user, I) ? <>{children}</> : null;
};
