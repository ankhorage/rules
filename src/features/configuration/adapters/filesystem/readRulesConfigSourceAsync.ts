import { readFile } from 'node:fs/promises';

/*** Read serialized Rules configuration at the filesystem edge. */
export async function readRulesConfigSourceAsync(path: string): Promise<string> {
  return await readFile(path, 'utf8');
}
