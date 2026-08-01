const base='/assets';
const championshipAssets:Record<string,string>={
  'formula-1':`${base}/sports/formula-1.svg`,
  motogp:`${base}/sports/motogp.svg`,
  wrc:`${base}/sports/wrc.svg`,
};
const circuitAssets:Record<string,string>={};
const countryAssets=new Set(['AU','DE','ES','FR','GB','IT','JP','US']);
export const assetRegistry={
  championship(slug?:string|null,authorizedUrl?:string|null){const src=authorizedUrl??(slug&&championshipAssets[slug]);return {src:src??`${base}/fallbacks/championship.svg`,alt:slug?`Identité visuelle ${slug}`:'Championnat',fallback:!src}},
  circuit(slug?:string|null){return {src:slug&&circuitAssets[slug]?circuitAssets[slug]:`${base}/fallbacks/championship.svg`,alt:slug?`Circuit ${slug}`:'Circuit',fallback:true}},
  country(code?:string|null){const normalized=code?.toUpperCase();const valid=normalized&&countryAssets.has(normalized);return {label:normalized&&/^[A-Z]{2}$/.test(normalized)?normalized:'--',src:valid?`${base}/flags/${normalized.toLowerCase()}.svg`:null,alt:normalized?`Drapeau ${normalized}`:'Pays non renseigné'}},
};
