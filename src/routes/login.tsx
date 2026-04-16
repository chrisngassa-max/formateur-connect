import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '@/components/LoginForm';

function LoginRoute() {
  return (
    <div className="relative">
      <LoginForm />
      <div
        className="pointer-events-none fixed bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/60 select-none"
        aria-hidden="true"
      >
        BUILD_ID: 2026-04-16-01
      </div>
    </div>
  );
}

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Connexion — Primo-Exercices' },
      { name: 'description', content: 'Connectez-vous à votre espace formateur.' },
    ],
  }),
  component: LoginRoute,
});
