// Permitir a usuarios del grupo GESTOR crear proyectos
permit (
  principal in SecureDonations::UserGroup::"GESTOR",
  action == SecureDonations::Action::"CreateProject",
  resource
);

// Permitir a usuarios del grupo GESTOR publicar proyectos existentes
permit (
  principal in SecureDonations::UserGroup::"GESTOR",
  action == SecureDonations::Action::"PublishProject",
  resource
);