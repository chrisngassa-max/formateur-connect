import type { ExerciceStatut } from '@/types/database';

const statutConfig: Record<ExerciceStatut, { label: string; className: string }> = {
  draft:      { label: 'Brouillon',  className: 'bg-muted text-muted-foreground' },
  to_review:  { label: 'En attente', className: 'bg-warning text-warning-foreground' },
  validated:  { label: 'Validé',     className: 'bg-success text-success-foreground' },
  published:  { label: 'Publié',     className: 'bg-primary text-primary-foreground' },
  archived:   { label: 'Archivé',    className: 'bg-muted text-muted-foreground' },
};

export function StatutBadge({ statut }: { statut: ExerciceStatut }) {
  const config = statutConfig[statut];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}
