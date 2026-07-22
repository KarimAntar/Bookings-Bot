/* biome-ignore-all lint/suspicious/noExplicitAny: Slack Bolt integration harness mirrors dynamic callback payloads. */
import { expect, test } from "bun:test";
import { registerMessageListener } from "../../src/slack/message-listener";
import { ReviewThreadStore } from "../../src/slack/review-thread-store";

const config = { slackBotToken:"xoxb-secret", slackAppToken:"xapp-secret", geminiApiKey:"secret-key-1", geminiModel:"model", allowedChannelIds:new Set<string>(), maxImageBytes:100, maxAttachments:4, downloadTimeoutMs:1000, aiTimeoutMs:1000, maxConcurrentReviews:3, maxQueuedReviews:3, dedupeTtlMs:1000, maxActiveReviews:10, activeReviewTtlMs:1000, lowConfidenceThreshold:.8, logLevel:"silent" as const };
const file = (id: string) => ({ id, name:`${id}.png`, mimetype:"image/png", size:1, url_private_download:"data:image/png;base64,AQ==" });
const correction = { status:"correction_required" as const, reasoning:"Please correct.", confidence:.9, evidenceRoles:[{imageId:"original:F1",roles:["booking_form" as const],readable:true}], crmFields:{}, bookingFields:{}, campaignRequirements:[], qualificationQuestions:[], notesSummary:{present:true,contentSummary:"Details present.",requiredEntriesPresent:true}, mismatches:[], missingNoteEntries:[], missingEvidence:["Updated booking"], failedRequirements:[], flags:["safe_public_summary"] };

const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; };

test("creates pending roots before awaits and serializes corrections without stale replies", async () => {
  let handler:any;
  const app={event:(_:string,fn:any)=>{handler=fn;}} as any;
  const posts:any[]=[];
  const client={chat:{postMessage:async(x:any)=>posts.push(x)},reactions:{add:async()=>{}}};
  const store=new ReviewThreadStore(10,1000);
  const first=deferred<typeof correction>();
  const second=deferred<typeof correction>();
  const requests:any[]=[];
  const review=async(request:any)=>{requests.push(request); return requests.length===1 ? first.promise : second.promise;};
  registerMessageListener(app,config,{review} as any,{debug(){},error(){},warn(){}} as any,store);

  const root=handler({event:{type:"message",channel:"C",ts:"1",text:"root",files:[file("F1")]},body:{event_id:"E1"},client});
  await Bun.sleep(10);
  expect(store.has("C","1")).toBe(true);
  const reply=handler({event:{type:"message",channel:"C",ts:"2",thread_ts:"1",text:"latest correction"},body:{event_id:"E2"},client});
  first.resolve(correction);
  await Bun.sleep(10);
  expect(requests).toHaveLength(2);
  expect(requests[1].messageText).toContain("latest correction");
  expect(posts).toHaveLength(0);
  second.resolve(correction);
  await Promise.all([root,reply]);
  expect(posts).toHaveLength(1);
});
