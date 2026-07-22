/* biome-ignore-all lint/suspicious/noExplicitAny: Provider capture inspects the external SDK's dynamic request shape. */
import { expect, mock, test } from "bun:test";
import { REVIEW_RESPONSE_SCHEMA } from "../../src/ai/booking-policy";
import { ReviewResultSchema } from "../../src/domain/review-result";

const valid={status:"approved" as const,reasoning:"ok",confidence:1,evidenceRoles:[{imageId:"original:F1",roles:["booking_form" as const],readable:true}],crmFields:{},bookingFields:{},campaignRequirements:[],qualificationQuestions:[],notesSummary:{present:true,contentSummary:"Guest and date present",requiredEntriesPresent:true},mismatches:[],missingNoteEntries:[],missingEvidence:[],failedRequirements:[],flags:["safe_public_summary"]};

test("JSON schema and Zod enforce notes and public flags constraints",()=>{
  expect(ReviewResultSchema.parse(valid)).toEqual(valid);
  expect(()=>ReviewResultSchema.parse({...valid,flags:[]})).toThrow();
  expect(REVIEW_RESPONSE_SCHEMA.required).toContain("notesSummary");
});

test("provider sends exactly one ordered package with fixed JSON config",async()=>{
  const generateContent=mock(async (_input:any)=>({text:JSON.stringify(valid)}));
  mock.module("@google/genai",()=>({GoogleGenAI:class { models={generateContent}; }}));
  const {GeminiProvider}=await import(`../../src/ai/gemini-provider.ts?capture=${Date.now()}`);
  const provider=new GeminiProvider("key","model-x",1000);
  await provider.review({eventId:"E",messageText:"correct",images:[
    {id:"correction:F2",name:"c",mimeType:"image/png",data:new Uint8Array([2]),source:"correction"},
    {id:"original:F1",name:"o",mimeType:"image/png",data:new Uint8Array([1]),source:"original"},
  ]});
  expect(generateContent).toHaveBeenCalledTimes(1);
  const call=generateContent.mock.calls[0]?.[0];
  expect(call).toBeDefined();
  if (!call) throw new Error("generateContent was not called");
  expect(call.model).toBe("model-x");
  expect(call.contents).toHaveLength(1);
  expect(call.contents[0].parts.filter((x:any)=>x.inlineData)).toHaveLength(2);
  expect(call.contents[0].parts.map((x:any)=>x.text??"").join(" ").indexOf("original:F1")).toBeLessThan(call.contents[0].parts.map((x:any)=>x.text??"").join(" ").indexOf("correction:F2"));
  expect(call.config).toMatchObject({responseMimeType:"application/json",responseJsonSchema:REVIEW_RESPONSE_SCHEMA,temperature:0});
});
