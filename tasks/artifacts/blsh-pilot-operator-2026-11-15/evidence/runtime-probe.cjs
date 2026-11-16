const tls=require('node:tls'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os');
const h=b=>crypto.createHash('sha256').update(b).digest('hex');
const v=process.config.variables;
const out={execPath:process.execPath,execSHA256:h(fs.readFileSync(process.execPath)),node:process.version,platform:process.platform,arch:process.arch,
openssl:process.versions.openssl,undici:process.versions.undici,tlsDefaultMin:tls.DEFAULT_MIN_VERSION,tlsDefaultMax:tls.DEFAULT_MAX_VERSION,
bundledRootCount:tls.rootCertificates.length,bundledRootsSHA256:h(tls.rootCertificates.join('\n')),
nodeUseOpensslCaBuild:v.node_use_openssl_ca,nodeSharedOpenssl:v.node_shared_openssl,opensslSystemCaPath:v.openssl_system_ca_path||null,
rejectUnauthorizedEnv:process.env.NODE_TLS_REJECT_UNAUTHORIZED??null,envKeys:Object.keys(process.env).sort(),tmpdir:os.tmpdir(),
budgetStoreWouldBe:require('node:path').join(os.tmpdir(),'fhfhockey-nst-budget-'+process.getuid())};
if(typeof tls.getCACertificates==='function'){for(const k of ['default','bundled','system','extra']){try{const c=tls.getCACertificates(k);out['ca_'+k]={count:c.length,sha256:h(c.join('\n'))}}catch(e){out['ca_'+k]=String(e.code||e.message)}}}
process.stdout.write(JSON.stringify(out,null,1)+'\n');
