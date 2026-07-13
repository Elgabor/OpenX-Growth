const X_API_ORIGIN = "https://api.x.com";

export type XFetch = (input:RequestInfo | URL,init?:RequestInit) => Promise<Response>;

export type XTransportRequest = {
  path:string;
  accessToken?:string;
  method?:string;
  headers?:HeadersInit;
  body?:BodyInit;
  json?:unknown;
  accounting?:{
    kind:"read"|"write"|"request";
    endpoint:string;
    reservedResources?:number;
    resourceCount?:(data:unknown)=>number;
  };
};

export type XTransportResult<T> = {
  ok:boolean;
  status:number;
  data?:T;
  rateLimit:{limit?:number;remaining?:number;resetAt?:number};
};

export type XTransport = {
  request<T=unknown>(input:XTransportRequest):Promise<XTransportResult<T>>;
};

export type XUsageReservation={kind:"read"|"write"|"request";endpoint:string;reservedResources:number;occurredAt:number};
export type XUsageOutcome={status:number;resources:number;rateLimit:XTransportResult<unknown>["rateLimit"];occurredAt:number};
export type XUsageAccounting={
  reserve(input:XUsageReservation):Promise<XUsageReservation>;
  complete(reservation:XUsageReservation,outcome:XUsageOutcome):Promise<void>;
};

function numericHeader(headers:Headers,name:string) {
  const value=headers.get(name);
  if(value===null)return undefined;
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:undefined;
}

export function createXTransport(options:{fetch?:XFetch;testMode?:boolean}={}):XTransport {
  const transportFetch=options.fetch??fetch;
  return {
    async request<T>(input:XTransportRequest) {
      if(options.testMode)throw new Error("LIVE_X_DISABLED_IN_TESTS");
      const url=new URL(input.path,X_API_ORIGIN);
      if(url.origin!==X_API_ORIGIN)throw new Error("INVALID_X_API_URL");
      const headers=new Headers(input.headers);
      if(input.accessToken)headers.set("Authorization",`Bearer ${input.accessToken}`);
      let body=input.body;
      if(input.json!==undefined){
        headers.set("Content-Type","application/json");
        body=JSON.stringify(input.json);
      }
      const response=await transportFetch(url,{method:input.method??"GET",headers,body,cache:"no-store"});
      let data:T|undefined;
      const contentType=response.headers.get("content-type")??"";
      if(contentType.includes("application/json")){
        try{data=await response.json() as T;}catch{}
      }
      return {
        ok:response.ok,
        status:response.status,
        data,
        rateLimit:{
          limit:numericHeader(response.headers,"x-rate-limit-limit"),
          remaining:numericHeader(response.headers,"x-rate-limit-remaining"),
          resetAt:numericHeader(response.headers,"x-rate-limit-reset"),
        },
      };
    },
  };
}

export function createAccountedXTransport(transport:XTransport,accounting:XUsageAccounting,options:{clock?:()=>number}={}):XTransport {
  const clock=options.clock??Date.now;
  return {
    async request<T>(input:XTransportRequest) {
      if(!input.accounting)return transport.request<T>(input);
      const occurredAt=clock();
      const reservation=await accounting.reserve({
        kind:input.accounting.kind,
        endpoint:input.accounting.endpoint,
        reservedResources:Math.max(0,Math.trunc(input.accounting.reservedResources??0)),
        occurredAt,
      });
      let result:XTransportResult<T>;
      try{
        result=await transport.request<T>(input);
      }catch(error){
        await accounting.complete(reservation,{status:0,resources:0,rateLimit:{},occurredAt:clock()});
        throw error;
      }
      const resources=input.accounting.kind==="read"&&result.ok
        ? Math.min(reservation.reservedResources,Math.max(0,Math.trunc(input.accounting.resourceCount?.(result.data)??0)))
        : 0;
      await accounting.complete(reservation,{status:result.status,resources,rateLimit:result.rateLimit,occurredAt:clock()});
      return result;
    },
  };
}

export function getXTransport():XTransport {
  const injected=globalThis.__OPENX_ENV__?.X_TRANSPORT;
  const transport=injected&&typeof injected==="object"&&"request" in injected
    ? injected as XTransport
    : createXTransport({testMode:globalThis.__OPENX_ENV__?.OPENX_E2E==="1"});
  const accounting:XUsageAccounting={
    async reserve(input){const {reserveXUsage}=await import("./data");return reserveXUsage(input)},
    async complete(reservation,outcome){const {completeXUsage}=await import("./data");await completeXUsage(reservation,outcome)},
  };
  return createAccountedXTransport(transport,accounting);
}
