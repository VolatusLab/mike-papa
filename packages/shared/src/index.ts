// @bnmp/shared — escopo restrito.
// PERMITIDO: schemas zod, env, errors, constants, utils puros.
// PROIBIDO: lógica BNMP, adapters HTTP, integrações externas, helpers de uma única feature.

export * from './env.js';
export * from './errors.js';
export * from './constants/index.js';
