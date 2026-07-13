import { desc, eq, lt, lte } from "drizzle-orm";
import { getD1, getDb } from "../db";
import { apiUsage, syncCache, xUsageEvents } from "../db/schema";
import { appConfig } from "./config";
import type { XUsageAccounting, XUsageOutcome, XUsageReservation } from "./x-transport";

const safeLimit=(value:number,fallback:number)=>Number.isFinite(value)&&value>=0?Math.trunc(value):fallback;
const usageDay=(timestamp:number)=>new Date(timestamp).toISOString().slice(0,10);

export async function reserveXUsage(input:XUsageReservation):Promise<XUsageReservation> {
  const config=appConfig();
  const maxResources=safeLimit(config.maxDailyResources,500),maxWrites=safeLimit(config.maxDailyWrites,50);
  const reservedResources=input.kind==="read"?Math.max(0,Math.trunc(input.reservedResources)):0;
  const writes=input.kind==="write"?1:0;
  if(reservedResources>maxResources)throw new Error("DAILY_X_RESOURCE_LIMIT_REACHED");
  if(writes>maxWrites)throw new Error("DAILY_X_WRITE_LIMIT_REACHED");
  const day=usageDay(input.occurredAt);
  const row=await getD1().prepare(`
    INSERT INTO api_usage (day,reads,requests,resources,reserved_resources,writes,updated_at)
    VALUES (?,0,1,0,?,?,?)
    ON CONFLICT(day) DO UPDATE SET
      requests=api_usage.requests+1,
      reserved_resources=api_usage.reserved_resources+excluded.reserved_resources,
      writes=api_usage.writes+excluded.writes,
      updated_at=excluded.updated_at
    WHERE api_usage.resources+api_usage.reserved_resources+excluded.reserved_resources<=?
      AND api_usage.writes+excluded.writes<=?
    RETURNING requests,resources,reserved_resources,writes
  `).bind(day,reservedResources,writes,input.occurredAt,maxResources,maxWrites).first();
  if(!row)throw new Error(input.kind==="write"?"DAILY_X_WRITE_LIMIT_REACHED":"DAILY_X_RESOURCE_LIMIT_REACHED");
  return {...input,reservedResources};
}

export async function completeXUsage(reservation:XUsageReservation,outcome:XUsageOutcome) {
  const day=usageDay(reservation.occurredAt);
  const resources=reservation.kind==="read"?Math.max(0,Math.trunc(outcome.resources)):0;
  const updated=await getD1().prepare(`
    UPDATE api_usage
    SET reads=reads+?,resources=resources+?,reserved_resources=reserved_resources-?,updated_at=?
    WHERE day=? AND reserved_resources>=?
    RETURNING resources,reserved_resources
  `).bind(resources,resources,reservation.reservedResources,outcome.occurredAt,day,reservation.reservedResources).first();
  if(!updated)throw new Error("X_USAGE_RESERVATION_NOT_FOUND");
  await getDb().insert(xUsageEvents).values({
    id:crypto.randomUUID(),
    day,
    endpoint:reservation.endpoint.slice(0,80),
    kind:reservation.kind,
    requestCount:1,
    resourceCount:resources,
    writeCount:reservation.kind==="write"?1:0,
    status:outcome.status,
    rateLimit:outcome.rateLimit.limit??null,
    rateRemaining:outcome.rateLimit.remaining??null,
    rateResetAt:outcome.rateLimit.resetAt??null,
    occurredAt:outcome.occurredAt,
  });
}

export const xUsageAccounting:XUsageAccounting={reserve:reserveXUsage,complete:completeXUsage};

export async function getUsage(now=Date.now()) {
  const day=usageDay(now),config=appConfig();
  const [current,events]=await Promise.all([
    getDb().select().from(apiUsage).where(eq(apiUsage.day,day)).get(),
    getDb().select().from(xUsageEvents).where(eq(xUsageEvents.day,day)).orderBy(desc(xUsageEvents.occurredAt)).limit(50),
  ]);
  const maxResources=safeLimit(config.maxDailyResources,500),maxWrites=safeLimit(config.maxDailyWrites,50);
  const resources=current?.resources??current?.reads??0,reservedResources=current?.reservedResources??0,writes=current?.writes??0;
  const remainingResources=Math.max(0,maxResources-resources-reservedResources),remainingWrites=Math.max(0,maxWrites-writes);
  return {
    requests:current?.requests??0,
    resources,
    reservedResources,
    writes,
    maxResources,
    maxWrites,
    remainingResources,
    remainingWrites,
    warning:remainingResources<=Math.max(1,Math.floor(maxResources*.1))||remainingWrites<=Math.max(1,Math.floor(maxWrites*.1)),
    // Compatibility aliases for existing API clients; UI labels use resource units.
    reads:resources,
    maxReads:maxResources,
    events:events.map((event)=>({
      endpoint:event.endpoint,
      kind:event.kind,
      requestCount:event.requestCount,
      resourceCount:event.resourceCount,
      writeCount:event.writeCount,
      status:event.status,
      rateLimit:event.rateLimit,
      rateRemaining:event.rateRemaining,
      rateResetAt:event.rateResetAt,
      occurredAt:event.occurredAt,
    })),
  };
}

export async function readCache<T>(key:string):Promise<T | null> {
  const row = await getDb().select().from(syncCache).where(eq(syncCache.key,key)).get();
  if (!row) return null;
  if (row.expiresAt < Date.now()) { await getDb().delete(syncCache).where(eq(syncCache.key,key)); return null; }
  try { return JSON.parse(row.payload) as T; } catch { return null; }
}

export async function deleteExpiredCache() {
  const db=getDb();
  await Promise.all([
    db.delete(syncCache).where(lte(syncCache.expiresAt,Date.now())),
    db.delete(xUsageEvents).where(lt(xUsageEvents.occurredAt,Date.now()-90*86_400_000)),
  ]);
}
export async function deleteXCache() { await getDb().delete(syncCache); }

export async function writeCache(key:string,payload:unknown,ttlSeconds:number) {
  const now = Date.now();
  await getDb().insert(syncCache).values({key,payload:JSON.stringify(payload),expiresAt:now+ttlSeconds*1000,updatedAt:now}).onConflictDoUpdate({target:syncCache.key,set:{payload:JSON.stringify(payload),expiresAt:now+ttlSeconds*1000,updatedAt:now}});
}
