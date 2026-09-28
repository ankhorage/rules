/***
 * Validate a repository rules.json file through the public generic Rules API.
 *
 * @title Validate Rules Configuration
 * @usage
 * @readme
 */
import { readRulesConfigAsync } from '@ankhorage/rules';

const result = await readRulesConfigAsync('rules.json');

if (result.diagnostics.length > 0) {
  throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join('\n'));
}
