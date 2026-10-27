/**
 * The longest input `parse()` accepts, in UTF-16 code units: 64 Mi.
 */
export const MAX_INPUT_LENGTH: number = 64 * 1024 * 1024;

/**
 * The deepest nesting of elements, the root element being level 1.
 */
export const MAX_DEPTH = 1024;

/**
 * The number of declared entity expansions in one document, nested ones
 * included. Predefined entities and character references are not counted.
 */
export const MAX_ENTITY_EXPANSIONS = 10_000;

/**
 * The number of characters that declared entities may expand to in one
 * document: 1 Mi.
 */
export const MAX_EXPANDED_LENGTH: number = 1024 * 1024;
