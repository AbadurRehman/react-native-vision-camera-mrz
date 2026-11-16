/**
 * Country and organization codes that can appear in an MRZ as the issuing
 * state or nationality (ICAO Doc 9303 Part 3): ISO 3166-1 alpha-3 codes plus
 * the codes ICAO adds. Only codes that can appear on documents still in
 * circulation are listed; retired ones (such as `ROM` or `YUG`) are not.
 */

/** ISO 3166-1 alpha-3 country codes. */
const ISO_3166_ALPHA_3 =
  'ABW AFG AGO AIA ALA ALB AND ARE ARG ARM ASM ATA ATF ATG AUS AUT AZE ' +
  'BDI BEL BEN BES BFA BGD BGR BHR BHS BIH BLM BLR BLZ BMU BOL BRA BRB ' +
  'BRN BTN BVT BWA CAF CAN CCK CHE CHL CHN CIV CMR COD COG COK COL COM ' +
  'CPV CRI CUB CUW CXR CYM CYP CZE DEU DJI DMA DNK DOM DZA ECU EGY ERI ' +
  'ESH ESP EST ETH FIN FJI FLK FRA FRO FSM GAB GBR GEO GGY GHA GIB GIN ' +
  'GLP GMB GNB GNQ GRC GRD GRL GTM GUF GUM GUY HKG HMD HND HRV HTI HUN ' +
  'IDN IMN IND IOT IRL IRN IRQ ISL ISR ITA JAM JEY JOR JPN KAZ KEN KGZ ' +
  'KHM KIR KNA KOR KWT LAO LBN LBR LBY LCA LIE LKA LSO LTU LUX LVA MAC ' +
  'MAF MAR MCO MDA MDG MDV MEX MHL MKD MLI MLT MMR MNE MNG MNP MOZ MRT ' +
  'MSR MTQ MUS MWI MYS MYT NAM NCL NER NFK NGA NIC NIU NLD NOR NPL NRU ' +
  'NZL OMN PAK PAN PCN PER PHL PLW PNG POL PRI PRK PRT PRY PSE PYF QAT ' +
  'REU ROU RUS RWA SAU SDN SEN SGP SGS SHN SJM SLB SLE SLV SMR SOM SPM ' +
  'SRB SSD STP SUR SVK SVN SWE SWZ SXM SYC SYR TCA TCD TGO THA TJK TKL ' +
  'TKM TLS TON TTO TUN TUR TUV TWN TZA UGA UKR UMI URY USA UZB VAT VCT ' +
  'VEN VGB VIR VNM VUT WLF WSM YEM ZAF ZMB ZWE';

/**
 * Codes defined by ICAO Doc 9303 Part 3 in addition to ISO 3166-1: `D`
 * (Germany), British nationality variants, Kosovo, the European Union, UN,
 * international organizations, refugee and stateless codes, and `UTO` (the
 * fictional state used in ICAO specimens).
 */
const ICAO_CODES =
  'D EUE GBD GBN GBO GBP GBS RKS UNA UNK UNO UTO XBA XCC XCE XCO XDC XEC ' +
  'XES XIM XMP XOM XPO XXA XXB XXC XXX';

const KNOWN_CODES: ReadonlySet<string> = new Set(
  `${ISO_3166_ALPHA_3} ${ICAO_CODES}`.split(' ')
);

const TRAILING_FILLERS = /<+$/;

/** `true` for a known code, with or without filler padding (`D` or `D<<`). */
export function isKnownStateCode(code: string): boolean {
  return KNOWN_CODES.has(code.replace(TRAILING_FILLERS, ''));
}
