const base='/assets';
const championshipAssets:Record<string,string>={};
const circuitAssets:Record<string,string>={};
export const assetRegistry={
  championship(slug?:string|null){return {src:slug&&championshipAssets[slug]?championshipAssets[slug]:`${base}/fallbacks/championship.svg`,alt:slug?`Logo ${slug}`:'Championnat',fallback:true}},
  circuit(slug?:string|null){return {src:slug&&circuitAssets[slug]?circuitAssets[slug]:`${base}/fallbacks/championship.svg`,alt:slug?`Circuit ${slug}`:'Circuit',fallback:true}},
  country(code?:string|null){const normalized=code?.toUpperCase();return {label:normalized&&/^[A-Z]{2}$/.test(normalized)?normalized:'--',alt:normalized?`Pays ${normalized}`:'Pays non renseigné'}},
};
