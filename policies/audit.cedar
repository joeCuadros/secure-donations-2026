// Permitir consultar logs de auditoría únicamente al grupo AUDITOR.
// El segundo factor (MFA TOTP) de AUDITOR se exige en Cognito, que actúa como Policy Administrator,
// con MFA obligatorio en el user pool: los access tokens de Cognito no incluyen
// el claim amr, por lo que no se evalúa una condición de MFA en Cedar.
permit (
  principal in SecureDonations::UserGroup::"AUDITOR",
  action == SecureDonations::Action::"ReadAuditLogs",
  resource
);
