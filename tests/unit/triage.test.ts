import { describe, it, expect } from 'vitest';
import { suggestPriority } from '../../src/lib/triage/triage';

describe('Triage Suggestion Rules', () => {
  it('detects red flag chest pain as urgent_review', () => {
    const result = suggestPriority({ symptoms: 'Patient has sudden chest pain and sweating' });
    expect(result.priority).toBe('urgent_review');
    expect(result.hasRedFlags).toBe(true);
    expect(result.matchedFlags).toContain('chest pain');
  });

  it('detects difficulty breathing as urgent_review', () => {
    const result = suggestPriority({ symptoms: 'Severe cough and difficulty breathing' });
    expect(result.priority).toBe('urgent_review');
    expect(result.hasRedFlags).toBe(true);
  });

  it('does not trigger red flag on isolated word chest without pain', () => {
    const result = suggestPriority({ symptoms: 'Minor skin rash on the upper chest area' });
    expect(result.priority).toBe('normal');
    expect(result.hasRedFlags).toBe(false);
  });

  it('detects age under 2 as needs_attention', () => {
    const result = suggestPriority({ symptoms: 'Mild fever for 1 day', patientAgeYears: 1 });
    expect(result.priority).toBe('needs_attention');
    expect(result.hasRedFlags).toBe(false);
  });

  it('returns normal for standard symptoms', () => {
    const result = suggestPriority({ symptoms: 'Mild sore throat and runny nose' });
    expect(result.priority).toBe('normal');
    expect(result.hasRedFlags).toBe(false);
  });
});
