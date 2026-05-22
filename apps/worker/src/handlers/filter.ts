import type { MonitoredCity } from '@bnmp/db';
import type { BnmpFilter } from '@bnmp/bnmp';

/** Build the canonical BNMP filter payload for a monitored city row. */
export function filterForCity(city: MonitoredCity): BnmpFilter {
  return {
    buscaOrgaoRecursivo: true,
    idEstado: city.idEstado,
    idMunicipio: city.idMunicipio,
    idTipoPeca: city.idTipoPeca,
    ...(city.idSexo != null ? { idSexo: city.idSexo } : {}),
    orgaoExpeditor: {},
  };
}
