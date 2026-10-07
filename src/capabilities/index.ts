import type { Capability } from '@ankhorage/contracts/capabilities';

export const CAPABILITIES = [
  {
    id: 'rules.config.validate',
    owner: '@ankhorage/rules',
    access: ['invoke'],
    binding: { kind: 'action', bindableAs: ['target'] },
    label: 'Validate rules configuration',
    description: 'Validate the generic JSON shape of a repository rules.json file.',
  },
] as const satisfies readonly Capability[];
