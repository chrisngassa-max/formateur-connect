import type { CompetenceType } from '@/types/database';

const competenceConfig: Record<CompetenceType, { label: string; className: string }> = {
  CO: { label: 'CO', className: 'bg-co text-co-foreground' },
  CE: { label: 'CE', className: 'bg-ce text-ce-foreground' },
  EE: { label: 'EE', className: 'bg-ee text-ee-foreground' },
  EO: { label: 'EO', className: 'bg-eo text-eo-foreground' },
};

export function CompetenceBadge({ competence }: { competence: CompetenceType }) {
  const config = competenceConfig[competence];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}
