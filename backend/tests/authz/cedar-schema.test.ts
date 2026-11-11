import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// HU-12 / CA-12.1: el policy store valida con STRICT un esquema embebido en la plantilla SAM.
// No existe validador Cedar en el repositorio, así que estas pruebas comprueban la coherencia entre
// la plantilla, policies/*.cedar y lo que el backend envía a Verified Permissions.
const ROOT = resolve(__dirname, '..', '..', '..');
const template = readFileSync(join(ROOT, 'infra', 'template.yaml'), 'utf-8');

interface CedarEntityType {
  shape?: { type: string; attributes: Record<string, { type: string; required?: boolean }> };
  memberOfTypes?: string[];
}
interface CedarAction {
  appliesTo: { principalTypes: string[]; resourceTypes: string[] };
}
interface CedarNamespace {
  entityTypes: Record<string, CedarEntityType>;
  actions: Record<string, CedarAction>;
}

// Devuelve las líneas del bloque escalar (`|`) que sigue a `key:` con una sangría mayor a la de la clave.
const blockScalar = (text: string, startIndex: number): string => {
  const lines = text.slice(startIndex).split('\n');
  const headerIndent = lines[0]!.search(/\S/);
  const body: string[] = [];
  for (const line of lines.slice(1)) {
    if (line.trim() === '') {
      body.push('');
      continue;
    }
    if (line.search(/\S/) <= headerIndent) break;
    body.push(line);
  }
  const indent = Math.min(...body.filter((l) => l !== '').map((l) => l.search(/\S/)));
  return body.map((l) => l.slice(indent)).join('\n').trim();
};

const templateSchema = (): Record<string, CedarNamespace> => {
  const marker = template.indexOf('CedarJson: |');
  expect(marker, 'la plantilla debe declarar Schema.CedarJson').toBeGreaterThan(-1);
  const lineStart = template.lastIndexOf('\n', marker) + 1;
  return JSON.parse(blockScalar(template, lineStart));
};

const normalize = (cedar: string): string =>
  cedar
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();

// Sentencias `permit` de la plantilla, por identificador lógico del recurso Policy.
const templatePolicies = (): Record<string, string> => {
  const result: Record<string, string> = {};
  const pattern = /^ {2}(\w+Policy):\n {4}Type: AWS::VerifiedPermissions::Policy/gm;
  for (const match of template.matchAll(pattern)) {
    const resourceStart = match.index!;
    const statementAt = template.indexOf('Statement: |', resourceStart);
    const lineStart = template.lastIndexOf('\n', statementAt) + 1;
    result[match[1]!] = normalize(blockScalar(template, lineStart));
  }
  return result;
};

const policyFiles = (): string[] => {
  const dir = join(ROOT, 'policies');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.cedar'))
    .flatMap((file) =>
      readFileSync(join(dir, file), 'utf-8')
        .split(/;\s*(?:\r?\n|$)/)
        .map((statement) => normalize(statement + ';'))
        .filter((statement) => statement.startsWith('permit') || statement.startsWith('forbid'))
    );
};

// Llamadas a authorizeActionService en el código: acción y tipo de recurso explícito (si lo hay).
const backendCalls = (): Array<{ action: string; resourceType: string | undefined }> => {
  const calls: Array<{ action: string; resourceType: string | undefined }> = [];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : []
    );
  for (const file of walk(join(ROOT, 'backend', 'src'))) {
    if (file.endsWith('avp.service.ts')) continue;
    const source = readFileSync(file, 'utf-8');
    for (const match of source.matchAll(/authorizeActionService\(\s*user,\s*'(\w+)'(?:,\s*'(\w+)')?/g)) {
      calls.push({ action: match[1]!, resourceType: match[2] });
    }
  }
  return calls;
};

describe('HU-12: esquema Cedar embebido y validación STRICT del policy store', () => {
  it('el policy store usa validación STRICT', () => {
    expect(template).toMatch(/ValidationSettings:\s*\n\s*Mode: "STRICT"/);
    expect(template).not.toMatch(/Mode: "OFF"/);
  });

  it('declara un único espacio de nombres SecureDonations con los tipos de entidad que envía el backend', () => {
    const schema = templateSchema();
    expect(Object.keys(schema)).toEqual(['SecureDonations']);
    const { entityTypes } = schema['SecureDonations']!;

    expect(Object.keys(entityTypes).sort()).toEqual(['Application', 'Donation', 'Project', 'User', 'UserGroup']);
    expect(entityTypes['User']!.memberOfTypes).toEqual(['UserGroup']);
    expect(entityTypes['User']!.shape!.attributes).toEqual({ sub: { type: 'String', required: true } });
    expect(entityTypes['Donation']!.shape!.attributes).toEqual({
      donorSub: { type: 'String', required: true },
      status: { type: 'String', required: true },
    });
    expect(Object.keys(entityTypes['Project']!.shape!.attributes)).toEqual(['status']);
    expect(Object.keys(entityTypes['Application']!.shape?.attributes ?? {})).toEqual([]);
  });

  it('define exactamente una acción por política, con principal User y el tipo de recurso correcto', () => {
    const { actions } = templateSchema()['SecureDonations']!;

    const applies = Object.fromEntries(
      Object.entries(actions).map(([name, action]) => [name, [action.appliesTo.principalTypes, action.appliesTo.resourceTypes]])
    );
    expect(applies).toEqual({
      CreateProject: [['User'], ['Application']],
      PublishProject: [['User'], ['Project']],
      CreateDonation: [['User'], ['Project']],
      SimulateDonation: [['User'], ['Donation']],
      ReadMyDonations: [['User'], ['Application']],
      ReadAuditLogs: [['User'], ['Application']],
      ListDraftProjects: [['User'], ['Application']],
    });
  });

  it('cada acción y tipo de recurso que usa el backend existe en el esquema', () => {
    const { actions } = templateSchema()['SecureDonations']!;
    const calls = backendCalls();

    expect(calls.map((c) => c.action).sort()).toEqual(
      [
        'CreateDonation',
        'CreateProject',
        'ListDraftProjects',
        'PublishProject',
        'ReadAuditLogs',
        'ReadMyDonations',
        'SimulateDonation',
      ]
    );
    for (const { action, resourceType } of calls) {
      expect(actions[action], `acción ${action}`).toBeDefined();
      // Sin tipo explícito, authorizeActionService envía el singleton Application.
      expect(actions[action]!.appliesTo.resourceTypes).toContain(resourceType ?? 'Application');
    }
  });

  it('las siete políticas de la plantilla coinciden con policies/*.cedar', () => {
    const fromTemplate = Object.values(templatePolicies()).sort();
    const fromFiles = policyFiles().sort();

    expect(fromTemplate).toHaveLength(7);
    expect(fromFiles).toEqual(fromTemplate);
  });

  it('CA-07.1: ReadMyDonations no declara una condición de propiedad sobre el recurso', () => {
    const policy = templatePolicies()['ReadMyDonationsPolicy']!;

    expect(policy).toContain('SecureDonations::Action::"ReadMyDonations"');
    expect(policy).not.toContain('when');
    expect(policy).not.toContain('donorSub');
  });

  it('HU-08 / CA-08.2: ListDraftProjects solo se concede al grupo GESTOR, sin condiciones sobre el recurso', () => {
    const policy = templatePolicies()['ListDraftProjectsPolicy']!;

    expect(policy).toContain('principal in SecureDonations::UserGroup::"GESTOR"');
    expect(policy).toContain('SecureDonations::Action::"ListDraftProjects"');
    expect(policy).not.toContain('when');
    expect(policy).not.toContain('DONANTE');
    expect(policy).not.toContain('AUDITOR');
  });

  it('CA-07.2: SimulateDonation conserva la condición real de propiedad principal.sub == resource.donorSub', () => {
    expect(templatePolicies()['SimulateDonationPolicy']).toContain('principal.sub == resource.donorSub');
  });

  it('las políticas solo acceden a atributos que el esquema declara, y los opcionales van protegidos con has', () => {
    const { entityTypes } = templateSchema()['SecureDonations']!;
    const policies = templatePolicies();

    expect(policies['CreateDonationPolicy']).toContain('resource has status && resource.status == "PUBLICADO"');
    expect(entityTypes['Project']!.shape!.attributes['status']!.required).toBe(false);
    expect(policies['SimulateDonationPolicy']).toContain('resource.donorSub');
    expect(entityTypes['Donation']!.shape!.attributes['donorSub']!.required).toBe(true);
  });

  it('el esquema legible policies/schema.cedarschema declara las mismas acciones y tipos que el JSON embebido', () => {
    const human = readFileSync(join(ROOT, 'policies', 'schema.cedarschema'), 'utf-8');
    const { entityTypes, actions } = templateSchema()['SecureDonations']!;

    expect(human).toContain('namespace SecureDonations');
    for (const type of Object.keys(entityTypes)) expect(human).toMatch(new RegExp(`entity ${type}\\b`));
    for (const [name, action] of Object.entries(actions)) {
      const declaration = new RegExp(`action "${name}" appliesTo \\{[^}]*resource: ${action.appliesTo.resourceTypes[0]}\\b`);
      expect(human, `acción ${name}`).toMatch(declaration);
    }
  });
});
