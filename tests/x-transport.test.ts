import assert from "node:assert/strict";
import test from "node:test";

import { createAccountedXTransport, createXTransport, type XFetch, type XUsageAccounting } from "../lib/x-transport.ts";

test("X transport accepts an injected deterministic fetch and returns structured metadata", async () => {
  const calls: Array<{ url:string; authorization:string | null }> = [];
  const fakeFetch:XFetch = async (input,init) => {
    const request = new Request(input,init);
    calls.push({url:request.url,authorization:request.headers.get("authorization")});
    return Response.json({data:{id:"fixture-post"}},{status:201,headers:{"x-rate-limit-remaining":"42"}});
  };
  const transport = createXTransport({fetch:fakeFetch});

  const result = await transport.request<{data:{id:string}}>({
    path:"/2/tweets",
    accessToken:"fixture-token",
    method:"POST",
    json:{text:"fixture"},
  });

  assert.deepEqual(calls,[{url:"https://api.x.com/2/tweets",authorization:"Bearer fixture-token"}]);
  assert.equal(result.ok,true);
  assert.equal(result.status,201);
  assert.equal(result.data?.data.id,"fixture-post");
  assert.equal(result.rateLimit.remaining,42);
});

test("X transport rejects non-X origins before calling fetch", async () => {
  let called=false;
  const transport=createXTransport({fetch:async()=>{called=true;return new Response();}});

  await assert.rejects(
    transport.request({path:"https://example.com/collect",accessToken:"fixture-token"}),
    /INVALID_X_API_URL/,
  );
  assert.equal(called,false);
});

test("X provider failures are deterministic and do not echo credentials", async () => {
  const transport=createXTransport({fetch:async()=>Response.json({error:"fixture failure"},{status:503})});
  const result=await transport.request<{error:string}>({path:"/2/tweets",accessToken:"fixture-token"});

  assert.equal(result.ok,false);
  assert.equal(result.status,503);
  assert.deepEqual(result.data,{error:"fixture failure"});
  assert.equal(JSON.stringify(result).includes("fixture-token"),false);
});

test("E2E mode cannot fall through to the live X transport", async () => {
  let called=false;
  const transport=createXTransport({fetch:async()=>{called=true;return new Response();},testMode:true});
  await assert.rejects(transport.request({path:"/2/users/me"}),/LIVE_X_DISABLED_IN_TESTS/);
  assert.equal(called,false);
});

test("accounted reads reserve worst-case resources then reconcile actual results", async () => {
  const events:unknown[]=[];
  const accounting:XUsageAccounting={
    async reserve(input){events.push(["reserve",input]);return {reservationId:"r1",...input}},
    async complete(reservation,outcome){events.push(["complete",reservation,outcome])},
  };
  const base=createXTransport({fetch:async()=>Response.json({data:[{id:"1"},{id:"2"}]},{status:200,headers:{"x-rate-limit-remaining":"7"}})});
  const transport=createAccountedXTransport(base,accounting,{clock:()=>123});
  const result=await transport.request<{data:Array<{id:string}>}>({path:"/2/users/owner/tweets",accounting:{kind:"read",endpoint:"users.posts",reservedResources:50,resourceCount:(data)=>(data as {data?:unknown[]}|undefined)?.data?.length??0}});
  assert.equal(result.status,200);
  assert.deepEqual(events,[
    ["reserve",{kind:"read",endpoint:"users.posts",reservedResources:50,occurredAt:123}],
    ["complete",{reservationId:"r1",kind:"read",endpoint:"users.posts",reservedResources:50,occurredAt:123},{status:200,resources:2,rateLimit:{limit:undefined,remaining:7,resetAt:undefined},occurredAt:123}],
  ]);
});

test("provider results cannot reconcile more resources than the atomic reservation",async()=>{
  let reconciled=-1;
  const accounting:XUsageAccounting={
    async reserve(input){return input},
    async complete(_reservation,outcome){reconciled=outcome.resources},
  };
  const transport=createAccountedXTransport(createXTransport({fetch:async()=>Response.json({data:[1,2,3,4]})}),accounting);
  await transport.request({path:"/2/users/owner/tweets",accounting:{kind:"read",endpoint:"users.posts",reservedResources:2,resourceCount:(data)=>(data as {data:unknown[]}).data.length}});
  assert.equal(reconciled,2);
});

test("failed calls and write retries are accounted as separate outbound attempts", async () => {
  const completed:Array<{kind:string;status:number;resources:number}>=[];
  const accounting:XUsageAccounting={
    async reserve(input){return input},
    async complete(reservation,outcome){completed.push({kind:reservation.kind,status:outcome.status,resources:outcome.resources})},
  };
  let calls=0;
  const base=createXTransport({fetch:async()=>{calls++;return Response.json({}, {status:calls===1?401:201})}});
  const transport=createAccountedXTransport(base,accounting,{clock:()=>456});
  await transport.request({path:"/2/tweets",method:"POST",accounting:{kind:"write",endpoint:"posts.create"}});
  await transport.request({path:"/2/tweets",method:"POST",accounting:{kind:"write",endpoint:"posts.create"}});
  assert.deepEqual(completed,[{kind:"write",status:401,resources:0},{kind:"write",status:201,resources:0}]);
});

test("429 and thrown provider failures release read reservations with zero resources", async () => {
  const outcomes:Array<{status:number;resources:number}>=[];
  const accounting:XUsageAccounting={
    async reserve(input){return input},
    async complete(_reservation,outcome){outcomes.push({status:outcome.status,resources:outcome.resources})},
  };
  const limited=createAccountedXTransport(createXTransport({fetch:async()=>new Response(null,{status:429})}),accounting);
  await limited.request({path:"/2/users/me",accounting:{kind:"read",endpoint:"users.me",reservedResources:1,resourceCount:()=>1}});
  const failed=createAccountedXTransport(createXTransport({fetch:async()=>{throw new Error("fixture network failure")}}),accounting);
  await assert.rejects(failed.request({path:"/2/users/me",accounting:{kind:"read",endpoint:"users.me",reservedResources:1,resourceCount:()=>1}}),/fixture network failure/);
  assert.deepEqual(outcomes,[{status:429,resources:0},{status:0,resources:0}]);
});

test("an accounting persistence failure is not reconciled twice", async () => {
  let completions=0;
  const accounting:XUsageAccounting={
    async reserve(input){return input},
    async complete(){completions++;throw new Error("fixture accounting failure")},
  };
  const transport=createAccountedXTransport(createXTransport({fetch:async()=>Response.json({data:[]})}),accounting);
  await assert.rejects(transport.request({path:"/2/users/me",accounting:{kind:"read",endpoint:"users.me",reservedResources:1,resourceCount:()=>1}}),/fixture accounting failure/);
  assert.equal(completions,1);
});
