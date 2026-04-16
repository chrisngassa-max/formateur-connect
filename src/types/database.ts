export type CompetenceType = 'CO' | 'CE' | 'EE' | 'EO';
export type ExerciceStatut = 'brouillon' | 'en_attente' | 'to_review' | 'valide' | 'publie' | 'rejete' | 'archive';
export type ExerciceFormat = 'qcm' | 'vrai_faux' | 'texte_libre' | 'association' | 'ordre';
export type NiveauCECR = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type AssignationMode = 'individuel' | 'groupe';

export interface Profile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: 'formateur' | 'eleve';
  created_at: string;
}

export interface Group {
  id: string;
  nom: string;
  formateur_id: string;
  created_at: string;
}

export interface Exercice {
  id: string;
  titre: string;
  competence: CompetenceType;
  format: ExerciceFormat;
  contenu: Record<string, unknown>;
  difficulte: number;
  niveau_vise: NiveauCECR;
  formateur_id: string;
  statut: ExerciceStatut;
  consigne?: string;
  is_live_ready?: boolean;
  play_token?: string;
  is_ai_generated?: boolean;
  created_at: string;
  updated_at: string;
}

export interface GabaritPedagogique {
  id: string;
  nom: string;
  description: string;
  competence: CompetenceType;
  format: ExerciceFormat;
  structure: Record<string, unknown>;
  created_at: string;
}

export interface Resultat {
  id: string;
  exercice_id: string;
  eleve_id: string;
  score: number;
  reponses_eleve: Record<string, unknown>;
  created_at: string;
  exercice?: Exercice;
  eleve?: Profile;
}

export interface Assignation {
  id: string;
  exercice_id: string;
  eleve_id?: string;
  group_id?: string;
  date_limite: string;
  mode: AssignationMode;
  created_at: string;
  exercice?: Exercice;
  eleve?: Profile;
  group?: Group;
}

export interface ExerciseAssignment {
  id: string; exercise_id: string; learner_id?: string;
  group_id?: string; assigned_by: string;
  context: 'autonomie' | 'devoir' | 'live' | 'remediation';
  due_date?: string; sequence_id?: string; session_id?: string;
  sync_status: string; created_at: string;
}

export interface ExerciseAttempt {
  id: string; exercise_id: string; assignment_id?: string;
  learner_id: string; started_at: string; completed_at?: string;
  time_spent_seconds?: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  score_raw?: number; score_normalized?: number;
  answers?: Record<string, unknown>; item_results?: Record<string, unknown>;
  feedback_text?: string; live_session_ref?: string; created_at: string;
}

// Minimal Database type — uses `any` for Insert/Update to avoid strict generic issues.
// Replace with generated types from `supabase gen types` for full type safety.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: any; Update: any };
      groups: { Row: Group; Insert: any; Update: any };
      exercices: { Row: Exercice; Insert: any; Update: any };
      gabarits_pedagogiques: { Row: GabaritPedagogique; Insert: any; Update: any };
      resultats: { Row: Resultat; Insert: any; Update: any };
      assignations: { Row: Assignation; Insert: any; Update: any };
      exercise_assignments: { Row: ExerciseAssignment; Insert: any; Update: any };
      exercise_attempts: { Row: ExerciseAttempt; Insert: any; Update: any };
    };
  };
}
