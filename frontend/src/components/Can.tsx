import React, { type ReactNode } from 'react';
import { useAuth } from 'react-oidc-context';
import { hasPermission } from '../utils/permissions';

interface CanProps {
  I: string; // El scope requerido, ej: "api/projects.write"
  children: ReactNode;
}

export const Can: React.FC<CanProps> = ({ I, children }) => {
  const auth = useAuth();
  if (!hasPermission(auth.user, I)) return null;
  return <>{children}</>;
};