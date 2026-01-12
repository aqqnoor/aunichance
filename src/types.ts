export interface StudentProfile {
  // Academic
  gpa?: number;
  gpaScale?: '4.0' | '5.0' | '100';
  englishTest?: 'IELTS' | 'TOEFL' | 'none';
  englishScore?: number;
  satScore?: number;
  actScore?: number;
  greScore?: number;
  gmatScore?: number;
  
  // Achievements
  olympiads?: string[];
  sports?: string[];
  volunteering?: string[];
  leadership?: string[];
  otherAchievements?: string[];
  
  // Preferences
  preferredCountries?: string[];
  preferredRegions?: string[];
  preferredFields?: string[];
  budget?: 'scholarship' | 'paid' | 'both';
  
  // Additional
  languages?: string[];
  skills?: string[];
  graduationYear?: number;
  citizenship?: string;
}

export interface University {
  id: string;
  name: string;
  country: string;
  city?: string;
  region: string;
  logo?: string;
  degree: 'Bachelor' | 'Master' | 'Both';
  fields: string[];
  
  // Requirements
  minGPA: number;
  minIELTS: number;
  minTOEFL?: number;
  requiresSAT?: boolean;
  requiresGRE?: boolean;
  requiresGMAT?: boolean;
  minSAT?: number;
  minGRE?: number;
  minGMAT?: number;
  
  // Statistics
  acceptanceRate: number;
  competition: 'low' | 'medium' | 'high' | 'very-high';
  avgGPA: number;
  avgIELTS: number;
  avgTOEFL?: number;
  
  // Additional info
  tuition?: number;
  scholarshipAvailable?: boolean;
  description?: string;
}

export interface AdmissionChance {
  university: University;
  chance: number; // 0-100
  category: 'reach' | 'target' | 'safety';
  reasons: string[];
  recommendations: string[];
}

export type Region = 'USA' | 'Europe' | 'UK' | 'Canada' | 'Australia' | 'Other';