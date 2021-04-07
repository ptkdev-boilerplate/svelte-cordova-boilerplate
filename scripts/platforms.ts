/**
 * Check configs.js
 * =====================
 * Check if configs/config.js exist, if don't exist rename .tpl
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: MIT License
 *
 */
import * as shell from "shelljs";

declare const __dirname: string;

shell.cp("-Rf", `${__dirname}/../dist/**/*`, `${__dirname}/../platforms/android/app/src/main/assets/www`);
shell.cp("-Rf", `${__dirname}/../dist/**/*`, `${__dirname}/../platforms/ios/www`);
