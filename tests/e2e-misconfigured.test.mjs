import assert from "node:assert/strict";
import test from "node:test";

const baseUrl=process.env.E2E_BASE_URL??"http://localhost:5176";

async function api(path,options={}){
  const response=await fetch(`${baseUrl}${path}`,{...options,headers:{accept:"application/json",...(options.headers??{})}});
  const body=await response.json();
  return {response,body};
}

test("configured instances without APP_ACCESS_TOKEN fail closed across data routes",async()=>{
  const cases=[
    ["/api/posts",{}],
    ["/api/analytics",{}],
    ["/api/data/export",{}],
    ["/api/x/status",{}],
    ["/api/x/sync",{}],
    ["/api/x/oauth/start",{redirect:"manual"}],
    ["/api/security/csrf",{}],
    ["/api/compliance",{}],
    ["/api/posts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text:"must not persist"})}],
    ["/api/cron/publish",{method:"POST",headers:{authorization:"Bearer e2e-cron-token"}}],
    ["/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:"anything"})}],
  ];
  for(const [path,options] of cases){
    const result=await api(path,options);
    assert.equal(result.response.status,503,path);
    assert.equal(result.body.error,"APP_ACCESS_TOKEN_REQUIRED",path);
  }
});

test("API and cron bearer tokens cannot bypass a missing application access gate",async()=>{
  const apiResult=await api("/api/posts",{headers:{authorization:"Bearer e2e-api-token"}});
  const cronResult=await api("/api/posts",{headers:{authorization:"Bearer e2e-cron-token"}});
  assert.equal(apiResult.response.status,503);
  assert.equal(cronResult.response.status,503);
});
