export function readProjectFilterQuery<T extends object>(params: { get(key: string): string | null }, defaults: T): T;
export function writeProjectFilterQuery<T extends object>(params: { toString(): string }, filters: T, defaults: T): string;
export function activeProjectFilterCount<T extends object>(filters: T, defaults: T): number;
