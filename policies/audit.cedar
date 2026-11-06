// Permitir consultar logs de auditoría únicamente al grupo AUDITOR con MFA verificado
permit (
  principal in SecureDonations::UserGroup::"AUDITOR",
  action == SecureDonations::Action::"ReadAuditLogs",
  resource
)
when {
  principal.isMfaVerified == true
};