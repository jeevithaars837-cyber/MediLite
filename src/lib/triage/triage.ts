import { PriorityLevel, TriageInput, TriageResult } from '@/types';

const RED_FLAGS = [
  'chest pain',
  'difficulty breathing',
  'trouble breathing',
  "can't breathe",
  'cant breathe',
  'shortness of breath',
  'unconscious',
  'fainted',
  'seizure',
  'severe bleeding',
  'heavy bleeding',
  'stroke',
  'face drooping',
  'slurred speech',
  'poison',
  'overdose',
  'snake bite',
  'suicidal',
  'throat swelling',
  'severe allergic',
];

const NEEDS_ATTENTION_FLAGS = [
  'vomiting blood',
  'blood in stool',
  'blood in urine',
  'high fever',
  'fever with rash',
  'infant',
  'baby',
  'pregnant',
  'spreading redness',
  'getting worse',
  'severe pain',
  'head injury',
];

export function suggestPriority(input: TriageInput): TriageResult {
  const textToScan = `${input.symptoms || ''} ${input.additionalNotes || ''}`.toLowerCase();
  
  const matchedRedFlags: string[] = [];
  for (const flag of RED_FLAGS) {
    // Word boundary search or substring match
    const regex = new RegExp(`\\b${flag}\\b`, 'i');
    if (regex.test(textToScan)) {
      matchedRedFlags.push(flag);
    }
  }

  if (matchedRedFlags.length > 0) {
    return {
      priority: 'urgent_review',
      hasRedFlags: true,
      matchedFlags: matchedRedFlags,
    };
  }

  // Check age rule (< 2 years)
  if (input.patientAgeYears !== undefined && input.patientAgeYears !== null && input.patientAgeYears < 2) {
    return {
      priority: 'needs_attention',
      hasRedFlags: false,
      matchedFlags: ['Age under 2 years'],
    };
  }

  const matchedAttentionFlags: string[] = [];
  for (const flag of NEEDS_ATTENTION_FLAGS) {
    const regex = new RegExp(`\\b${flag}\\b`, 'i');
    if (regex.test(textToScan)) {
      matchedAttentionFlags.push(flag);
    }
  }

  if (matchedAttentionFlags.length > 0) {
    return {
      priority: 'needs_attention',
      hasRedFlags: false,
      matchedFlags: matchedAttentionFlags,
    };
  }

  return {
    priority: 'normal',
    hasRedFlags: false,
    matchedFlags: [],
  };
}
