import { expect, test } from "bun:test";
import { ReviewThreadStore } from "../../src/slack/review-thread-store";
const image=(id:string,source:"original"|"correction"="original")=>({id,name:id,mimeType:"image/png" as const,data:new Uint8Array([1]),source});

test("validates constructor arguments and refuses duplicate roots",()=>{
  expect(()=>new ReviewThreadStore(0,1000)).toThrow();
  expect(()=>new ReviewThreadStore(1,0)).toThrow();
  const store=new ReviewThreadStore(1,1000);
  store.create({channel:"C",rootTs:"1",originalText:"a",originalImages:[image("original:F1")],lastEventId:"E1"});
  expect(()=>store.create({channel:"C",rootTs:"1",originalText:"b",originalImages:[image("original:F2")],lastEventId:"E2"})).toThrow();
  expect(store.get("C","1")?.evidence.messageText).toBe("a");
});

test("evicts deterministically when timestamps are equal",()=>{
  const store=new ReviewThreadStore(2,1000,()=>1);
  store.create({channel:"C",rootTs:"b",originalText:"",originalImages:[image("original:b")],lastEventId:"b"});
  store.create({channel:"C",rootTs:"a",originalText:"",originalImages:[image("original:a")],lastEventId:"a"});
  store.create({channel:"C",rootTs:"c",originalText:"",originalImages:[image("original:c")],lastEventId:"c"});
  expect(store.has("C","a")).toBe(false);
  expect(store.has("C","b")).toBe(true);
});

test("correction images must have stable unique validated IDs",()=>{
  const store=new ReviewThreadStore(1,1000);
  store.create({channel:"C",rootTs:"1",originalText:"",originalImages:[image("original:F1")],lastEventId:"E1"});
  expect(()=>store.applyCorrection("C","1",{text:"",images:[image("original:F1","correction")],eventId:"E2"})).toThrow();
});
