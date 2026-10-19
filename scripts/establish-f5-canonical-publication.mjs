#!/usr/bin/env node
if(process.env.F57B_ESTABLISH!=='authorized')throw new Error('F57B establishment requires explicit authorization.');
const [{pool},{CanonicalCatalogPublicationService}]=await Promise.all([
  import('../apps/api/dist/lib/db.js'),
  import('../apps/api/dist/public/canonicalCatalogPublicationService.js')
]);
try{
  const head=(await pool.query('select version from schema_migrations order by version desc limit 1')).rows[0]?.version;
  if(head!=='0038_f5_canonical_publication')throw new Error('F57B establishment requires schema head 0038_f5_canonical_publication.');
  const result=await new CanonicalCatalogPublicationService().establish(new Date());
  process.stdout.write(`${JSON.stringify(result)}\n`);
}finally{await pool.end();}
