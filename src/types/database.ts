export type CompetenceType = 'CO' | 'CE' | 'EE' | 'EO';
export type ExerciceStatut = 'brouillon' | 'draft' | 'en_attente' | 'valide' | 'publie' | 'rejete' | 'archive';
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

// ============= Placement tests =============
export type PlacementSkill = 'CE' | 'CO' | 'EE' | 'EO';
export type PlacementLevel = 'A0' | 'A1' | 'A2' | 'B1' | 'B2';
export type PlacementTestStatus = 'draft' | 'review' | 'published' | 'archived';
export type PlacementAttemptStatus = 'in_progress' | 'completed' | 'abandoned';
export type PlacementExportFormat = 'json' | 'api';
export type PlacementExportStatus = 'draft' | 'exported' | 'synced' | 'failed';

export interface PlacementTest {
  id: string;
  title: string;
  target_exam: string;
  target_public: string;
  status: PlacementTestStatus;
  niveaux_couverts: string[];
  competences: string[];
  contexte?: string | null;
  version: number;
  play_token?: string | null;
  created_by?: string | null;
  validated_by?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlacementTestItem {
  id: string;
  test_id: string;
  skill: PlacementSkill;
  level_cecrl: PlacementLevel;
  difficulty?: number | null;
  context?: string | null;
  support_type?: string | null;
  support?: string | null;
  prompt?: string | null;
  question?: string | null;
  options?: Record<string, unknown> | unknown[] | null;
  correct_answer?: string | null;
  explanation?: string | null;
  distractors_analysis?: string | null;
  tags: string[];
  score: number;
  order_index: number;
  is_validated: boolean;
  audio_script?: string | null;
  created_at: string;
}

export interface PlacementTestAttempt {
  id: string;
  test_id: string;
  student_id?: string | null;
  student_name?: string | null;
  started_at: string;
  completed_at?: string | null;
  status: PlacementAttemptStatus;
  total_score?: number | null;
  max_score?: number | null;
  estimated_level?: string | null;
  created_at: string;
}

export interface PlacementTestAnswer {
  id: string;
  attempt_id: string;
  item_id: string;
  student_answer?: string | null;
  is_correct?: boolean | null;
  score?: number | null;
  time_spent?: number | null;
  error_tags: string[];
  teacher_feedback?: string | null;
  created_at: string;
}

export interface PlacementTestResult {
  id: string;
  attempt_id: string;
  global_level?: string | null;
  co_level?: string | null;
  ce_level?: string | null;
  ee_level?: string | null;
  eo_level?: string | null;
  global_score_pct?: number | null;
  co_score_pct?: number | null;
  ce_score_pct?: number | null;
  ee_score_pct?: number | null;
  eo_score_pct?: number | null;
  strengths: string[];
  weaknesses: string[];
  recommended_group?: string | null;
  recommended_pathway?: string | null;
  teacher_notes?: string | null;
  remediation_exercises?: Record<string, unknown> | null;
  raw_analysis?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PlacementTestExport {
  id: string;
  test_id: string;
  schema_version: string;
  export_format?: PlacementExportFormat | null;
  target_site?: string | null;
  public_payload: Record<string, unknown>;
  private_answer_key: Record<string, unknown>;
  export_status: PlacementExportStatus;
  export_url?: string | null;
  access_token?: string | null;
  created_at: string;
  exported_at?: string | null;
  last_synced_at?: string | null;
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
      
      exercise_assignments: { Row: ExerciseAssignment; Insert: any; Update: any };
      exercise_attempts: { Row: ExerciseAttempt; Insert: any; Update: any };
    };
  };
}
