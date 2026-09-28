/***
 * Validate a repository rules.json file through the public generic Rules API.
 *
 * @title Validate Rules Configuration
 * @usage
 * @readme
 */
import { validateRulesConfigFileAsync } from '@ankhorage/rules';

const result = await validateRulesConfigFileAsync('rules.json', process.cwd());

if (result.diagnostics.length > 0) {
  throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join('\n'));
}
