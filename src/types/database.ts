export type CompetenceType = 'CO' | 'CE' | 'EE' | 'EO';
export type ExerciceStatut = 'brouillon' | 'en_attente' | 'valide' | 'rejete';
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
  temps_seconds: number;
  reponses: Record<string, unknown>;
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

// Supabase generated types placeholder
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile };
      groups: { Row: Group };
      exercices: { Row: Exercice };
      gabarits_pedagogiques: { Row: GabaritPedagogique };
      resultats: { Row: Resultat };
      assignations: { Row: Assignation };
    };
  };
}
