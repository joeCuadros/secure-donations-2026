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

// Permitir a usuarios del grupo GESTOR listar los proyectos en borrador (HU-08).
// Cualquier GESTOR ve todos los borradores, igual que PublishProject permite a cualquier GESTOR publicar.
permit (
  principal in SecureDonations::UserGroup::"GESTOR",
  action == SecureDonations::Action::"ListDraftProjects",
  resource
);
