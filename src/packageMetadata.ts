import packageJson from '../package.json';

/*** The Rules CLI category exposed through the Ankh command bus. */
export const RULES_COMMAND_CATEGORY = 'rules';

/*** The initial Rules capability provided by the standalone config validator. */
export const RULES_CAPABILITIES = ['rules.config.validate'] as const;

/*** The package version used in provider descriptors. */
export const RULES_PACKAGE_VERSION = packageJson.version;
