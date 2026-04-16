import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '@/components/LoginForm';

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Connexion — Primo-Exercices' },
      { name: 'description', content: 'Connectez-vous à votre espace formateur.' },
    ],
  }),
  component: LoginForm,
});
