/**
 * Delete platforms folder
 * =====================
 *
 * @contributors: Patryk Rzucidło [@ptkdev] <support@ptkdev.io> (https://ptk.dev)
 *
 * @license: MIT License
 *
 */
declare const __dirname: string;

const path = `${__dirname}/../platforms`;

shell.rm("-Rf", path);
