import { describe, it, expect } from 'vitest';
import { validateSelectQuery } from './datasetTools';

describe('validateSelectQuery', () => {
  // Valid SELECT queries on rent data
  it('allows valid SELECT queries', () => {
    expect(validateSelectQuery('SELECT * FROM rent')).toBe(true);
    expect(validateSelectQuery('SELECT LGA, MedianWeeklyRent FROM rent_comparison WHERE MedianWeeklyRent > 400')).toBe(true);
    expect(validateSelectQuery('   SELECT * FROM rent_comparison')).toBe(true);
  });

  // Reject empty or non-SELECT queries
  it('rejects empty and non-SELECT queries', () => {
    expect(validateSelectQuery('')).toBe(false);
    expect(validateSelectQuery('UPDATE rent SET MedianWeeklyRent = 500')).toBe(false);
    expect(validateSelectQuery('   ')).toBe(false);
  });

  // Reject queries with forbidden SQL keywords
  it('rejects forbidden SQL keywords', () => {
    const forbiddenKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate', 'grant', 'revoke'];
    forbiddenKeywords.forEach(keyword => {
      const query = `SELECT * FROM rent_comparison; ${keyword} something`;
      const result = validateSelectQuery(query);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(`Forbidden keyword: ${keyword}`);
    });
  });

  // Reject forbidden keywords regardless of case
  it('rejects forbidden keywords regardless of case', () => {
    expect(validateSelectQuery('SELECT * FROM rent; DROP TABLE rent')).toBe(false);
    expect(validateSelectQuery('SELECT * FROM rent; dRoP TABLE rent')).toBe(false);
  });

  // Allow column/table names that contain forbidden substrings
  it('allows column/table names containing forbidden substrings', () => {
    expect(validateSelectQuery('SELECT updated_at FROM rent')).toBe(true);
    expect(validateSelectQuery('SELECT created_at, deleted_flag FROM rent_comparison')).toBe(true);
  });
});

