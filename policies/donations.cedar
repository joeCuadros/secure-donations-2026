// Permitir a usuarios del grupo DONANTE intencionar donaciones en proyectos publicados
permit (
  principal in SecureDonations::UserGroup::"DONANTE",
  action == SecureDonations::Action::"CreateDonation",
  resource
)
when {
  resource has status && resource.status == "PUBLICADO"
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

// Permitir al grupo DONANTE consultar su historial de donaciones (CA-07.1).
// No hay condición de propiedad en Cedar: principal.sub == resource.donorSub sería una tautología, porque
// el historial no tiene un recurso persistido que comparar. La propiedad se garantiza de forma estructural en
// el handler: la consulta usa el sub verificado del token como clave de partición del índice
// donorSub-createdAt y no acepta ningún identificador enviado por el cliente.
permit (
  principal in SecureDonations::UserGroup::"DONANTE",
  action == SecureDonations::Action::"ReadMyDonations",
  resource
);