import type { CharacterData } from './character.js';

/**
 * Result type for provider operations
 */
export type ProviderResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

/**
 * Data provider interface for character stroke data
 */
export interface DataProvider {
  /** Unique identifier for this provider */
  readonly id: string;

  /**
   * Fetch character data
   * @param char - The character to look up
   * @returns Promise resolving to result with character data or error
   */
  getCharacter(char: string): Promise<ProviderResult<CharacterData>>;

  /**
   * Check if this provider can handle the given character
   * @param char - The character to check
   * @returns true if this provider can handle the character
   */
  canHandle(char: string): boolean;
}
