// Permitir a usuarios del grupo DONANTE intencionar donaciones en proyectos publicados
permit (
  principal in SecureDonations::UserGroup::"DONANTE",
  action == SecureDonations::Action::"CreateDonation",
  resource
)
when {
  resource.status == "PUBLICADO"
};

// Permitir simular donación solo si el principal es el propietario de la donación (BOLA Guard)
permit (
  principal in SecureDonations::UserGroup::"DONANTE",
  action == SecureDonations::Action::"SimulateDonation",
  resource
)
when {
  principal.sub == resource.donorSub
};

// Permitir listar donaciones solo sobre el propio historial
permit (
  principal in SecureDonations::UserGroup::"DONANTE",
  action == SecureDonations::Action::"ReadMyDonations",
  resource
)
when {
  principal.sub == resource.donorSub
};