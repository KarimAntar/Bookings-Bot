/* biome-ignore-all lint/suspicious/noExplicitAny: Slack Bolt integration harness mirrors dynamic callback payloads. */
import { describe, expect, test } from "bun:test";
import { registerMessageListener } from "../../src/slack/message-listener";
import { ReviewThreadStore } from "../../src/slack/review-thread-store";
import { formatReviewResult } from "../../src/slack/format";

const config = { slackBotToken:"xoxb-secret", slackAppToken:"xapp-secret", geminiApiKey:"secret-key-1", geminiModel:"model", allowedChannelIds:new Set<string>(), maxImageBytes:100, maxAttachments:4, downloadTimeoutMs:1000, aiTimeoutMs:1000, maxConcurrentReviews:1, maxQueuedReviews:0, dedupeTtlMs:1000, maxActiveReviews:10, activeReviewTtlMs:1000, lowConfidenceThreshold:.8, logLevel:"silent" as const };
const file = { id:"F1", name:"one.png", mimetype:"image/png", size:1, url_private_download:"data:image/png;base64,AQ==" };
const result = (status: "approved"|"correction_required"|"needs_human_review"|"rejected") => ({ status, reasoning:"Unsafe <@U1> & <!channel>", confidence:.9, evidenceRoles:[{imageId:"original:F1",roles:["booking_form" as const],readable:true}], crmFields:{}, bookingFields:{}, campaignRequirements:[], qualificationQuestions:[], notesSummary:{present:true,contentSummary:"Name <script>",requiredEntriesPresent:true}, mismatches:[], missingNoteEntries:[], missingEvidence:[], failedRequirements:[], flags:["safe_public_summary"] });

function harness(review: (request: unknown) => Promise<ReturnType<typeof result>> = async () => result("correction_required")) {
  let handler: any;
  const app = { event: (_: string, fn: any) => { handler = fn; } } as any;
  const posts:any[]=[]; const reactions:any[]=[];
  const client={ chat:{postMessage:async (x:any)=>posts.push(x)}, reactions:{add:async(x:any)=>reactions.push(x)} };
  const store=new ReviewThreadStore(10,1000);
  registerMessageListener(app,config,{review} as any,{debug(){},error(){},warn(){}} as any,store);
  return { handler, posts, reactions, store, client };
}

describe("actual Slack listener",()=>{
  test("creates a root session and applies a text-only correction using original evidence",async()=>{
    const requests:any[]=[]; const h=harness(async (request:any)=>{requests.push(request); return result("correction_required");});
    await h.handler({event:{type:"message",channel:"C",ts:"1",text:"root",files:[file]},body:{event_id:"E1"},client:h.client});
    await h.handler({event:{type:"message",channel:"C",ts:"2",thread_ts:"1",text:"correct phone"},body:{event_id:"E2"},client:h.client});
    expect(requests).toHaveLength(2);
    expect(requests[1].images.map((x:any)=>x.id)).toEqual(["original:F1"]);
    expect(requests[1].messageText).toContain("correct phone");
    expect(h.posts).toHaveLength(2);
  });
  test("closes a newly-created session when root processing fails",async()=>{
    const h=harness();
    await h.handler({event:{type:"message",channel:"C",ts:"bad",files:[{...file,mimetype:"text/plain"}]},body:{event_id:"EB"},client:h.client});
    expect(h.store.has("C","bad")).toBe(false);
  });
});

test("formatter escapes model text and reserves <!here> for human review",()=>{
  for(const status of ["approved","correction_required","rejected"] as const) expect(formatReviewResult(result(status))).not.toContain("<!here>");
  const text=formatReviewResult(result("needs_human_review"));
  expect(text.match(/<!here>/g)).toHaveLength(1);
  expect(text).not.toContain("<@U1>");
  expect(text).not.toContain("<!channel>");
  expect(text).toContain("&amp;");
});
