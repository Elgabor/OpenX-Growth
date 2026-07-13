import type { NextRequest, NextResponse } from "next/server";
import { appConfig, deploymentPosture, instanceConfigured } from "./config.ts";

export const SESSION_COOKIE = "__Host-openx_session";
export const OAUTH_COOKIE = "__Host-openx_oauth";
export const CSRF_COOKIE = "__Host-openx_csrf";
export const AUTH_COOKIE = "__Host-openx_auth";

export type XSession = { accessToken:string; refreshToken?:string; clientId:string; expiresAt:number };

export function cookieName(name:string,secure:boolean) { return secure ? name : name.replace(/^__Host-/,""); }
export function readCookie(request:NextRequest,name:string) { return request.cookies.get(name)?.value ?? request.cookies.get(cookieName(name,false))?.value; }

const encode = (bytes:Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const decode = (value:string) => Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=")),(char)=>char.charCodeAt(0));

async function key() {
  const secret = appConfig().sessionSecret;
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}

export async function seal(value:unknown):Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),new TextEncoder().encode(JSON.stringify(value)));
  return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}

export async function unseal<T>(value?:string):Promise<T | null> {
  if (!value) return null;
  try {
    const [iv,data] = value.split(".");
    const decrypted = await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(iv)},await key(),decode(data));
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch { return null; }
}

export async function getXSession(request:NextRequest) { return unseal<XSession>(readCookie(request,SESSION_COOKIE)); }

export async function setXSession(response:NextResponse,session:XSession,secure=true) {
  response.cookies.set(cookieName(SESSION_COOKIE,secure),await seal(session),{httpOnly:true,secure,sameSite:"lax",path:"/",maxAge:2_592_000});
}

export function clearXSession(response:NextResponse,secure=true) {
  response.cookies.set(cookieName(SESSION_COOKIE,secure),"",{httpOnly:true,secure,sameSite:"lax",path:"/",maxAge:0});
  if(secure) response.cookies.set(cookieName(SESSION_COOKIE,false),"",{httpOnly:true,secure:false,sameSite:"lax",path:"/",maxAge:0});
}

export function randomToken(bytes=24) { return encode(crypto.getRandomValues(new Uint8Array(bytes))); }

export async function safeEqual(left:string,right:string) {
  const [a,b] = await Promise.all([left,right].map((value)=>crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
  const aa=new Uint8Array(a),bb=new Uint8Array(b);let difference=0;
  for(let index=0;index<aa.length;index++)difference|=aa[index]^bb[index];
  return difference===0;
}

export function requireCsrf(request:NextRequest) {
  const cookie = readCookie(request,CSRF_COOKIE);
  const header = request.headers.get("x-csrf-token");
  if (!cookie || !header || cookie !== header) throw new Error("CSRF_VALIDATION_FAILED");
}

export function hasApiAuth(request:NextRequest) {
  const token = appConfig().apiToken;
  return Boolean(token && request.headers.get("authorization") === `Bearer ${token}`);
}

export function isAccessProtected() {
  return Boolean(appConfig().appAccessToken);
}

export async function hasAppAccess(request:NextRequest) {
  const posture=deploymentPosture();
  if(posture==="demo")return true;
  if(posture==="misconfigured")return false;
  const auth = await unseal<{authorized:boolean;expiresAt:number}>(readCookie(request,AUTH_COOKIE));
  return auth?.authorized === true&&Number.isFinite(auth.expiresAt)&&auth.expiresAt>Date.now();
}

function postureResponse() {
  return deploymentPosture()==="misconfigured"
    ? Response.json({error:"APP_ACCESS_TOKEN_REQUIRED",message:"Configured instances must set APP_ACCESS_TOKEN before any application data is exposed."},{status:503,headers:{"Cache-Control":"no-store"}})
    : null;
}

export function configuredAccessGateResponse(){return postureResponse();}

const unauthorizedResponse=()=>Response.json({error:"UNAUTHORIZED"},{status:401,headers:{"Cache-Control":"no-store"}});

export async function authorizeBrowserRead(request:NextRequest) {
  const blocked=postureResponse();
  if(blocked)return blocked;
  return await hasAppAccess(request)?null:unauthorizedResponse();
}

export async function authorizeBrowserOrApiRead(request:NextRequest) {
  const blocked=postureResponse();
  if(blocked)return blocked;
  if(hasApiAuth(request))return null;
  return await hasAppAccess(request)?null:unauthorizedResponse();
}

export async function authorizeBrowserMutation(request:NextRequest) {
  const unconfigured=configuredInstanceResponse();
  if(unconfigured)return unconfigured;
  const denied=await authorizeBrowserRead(request);
  if(denied)return denied;
  try{requireCsrf(request);return null;}catch{return Response.json({error:"INVALID_CSRF"},{status:403});}
}

export async function authorizeBrowserOrApiMutation(request:NextRequest) {
  const unconfigured=configuredInstanceResponse();
  if(unconfigured)return unconfigured;
  const denied=await authorizeBrowserOrApiRead(request);
  if(denied)return denied;
  if(hasApiAuth(request))return null;
  try{requireCsrf(request);return null;}catch{return Response.json({error:"INVALID_CSRF"},{status:403});}
}

export function configuredInstanceResponse() {
  if (instanceConfigured()) return null;
  return Response.json({error:"INSTANCE_NOT_CONFIGURED",message:"Configure X_CLIENT_ID and SESSION_SECRET in your environment to enable this action."},{status:503});
}
