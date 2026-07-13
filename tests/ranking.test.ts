import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ALGORITHM_VERSION,
  extractTopicPhrases,
  generateIdeas,
  rankReplyOpportunities,
  tokenizeText,
  type RankingFeedback,
  type XPost,
  type XUser,
} from "../lib/x-growth.ts";

const fixture=JSON.parse(readFileSync(new URL("./fixtures/ranking-eval.json",import.meta.url),"utf8")) as {
  now:string;users:XUser[];posts:XPost[];ownPosts:XPost[];relevantIds:string[];
};
const NOW=new Date(fixture.now).getTime();
const clock=()=>NOW;

test("Unicode tokenization and phrase extraction cover English and Italian", () => {
  assert.deepEqual(tokenizeText("Perché l’intelligenza artificiale è utile per the startup italiane"),["intelligenza","artificiale","utile","startup","italiane"]);
  assert.ok(extractTopicPhrases("L’intelligenza artificiale migliora. Intelligenza artificiale responsabile.").includes("intelligenza artificiale"));
});

test("reply ranking is deterministic with an injected clock and explainable features", () => {
  const options={clock,ownPosts:fixture.ownPosts,feedback:[]};
  const first=rankReplyOpportunities(fixture.posts,fixture.users,options);
  const second=rankReplyOpportunities(fixture.posts,fixture.users,options);
  assert.deepEqual(first,second);
  assert.equal(first[0].algorithmVersion,ALGORITHM_VERSION);
  assert.ok(first[0].featureExplanation!.topics.length>0);
  assert.match(first[0].reason,/freshness|topical affinity|engagement|feedback/i);
  assert.ok(first.find((row)=>row.id==="p-stale")!.featureExplanation!.freshness<0.05);
  assert.equal(first.find((row)=>row.id==="p-reply")!.featureExplanation!.isReply,true);
  assert.equal(first.find((row)=>row.id==="p-reply")!.featureExplanation!.missingMetrics,true);
});

test("bounded positive and negative feedback changes related candidate scores", () => {
  const baseOptions={clock,ownPosts:fixture.ownPosts};
  const base=rankReplyOpportunities(fixture.posts,fixture.users,{...baseOptions,feedback:[]}).find((row)=>row.id==="p-ai-it")!;
  const positive:RankingFeedback[]=[{targetType:"idea",targetId:"intelligenza artificiale",vote:1,context:{topic:"intelligenza artificiale"},createdAt:NOW}];
  const negative:RankingFeedback[]=[{targetType:"idea",targetId:"intelligenza artificiale",vote:-1,context:{topic:"intelligenza artificiale"},createdAt:NOW}];
  const boosted=rankReplyOpportunities(fixture.posts,fixture.users,{...baseOptions,feedback:positive}).find((row)=>row.id==="p-ai-it")!;
  const reduced=rankReplyOpportunities(fixture.posts,fixture.users,{...baseOptions,feedback:negative}).find((row)=>row.id==="p-ai-it")!;
  assert.ok(boosted.relevance>base.relevance);
  assert.ok(reduced.relevance<base.relevance);
  assert.ok(Math.abs(boosted.featureExplanation!.feedback)<=12);
  assert.ok(Math.abs(reduced.featureExplanation!.feedback)<=12);
});

test("diversity prevents one author or near-duplicate cluster from dominating", () => {
  const ranked=rankReplyOpportunities(fixture.posts,fixture.users,{clock,ownPosts:fixture.ownPosts,feedback:[],limit:5});
  assert.ok(ranked.filter((row)=>row.handle==="@ai_builder").length<=1);
  assert.ok(new Set(ranked.map((row)=>row.featureExplanation!.cluster)).size>=4);
});

test("idea generation is multilingual, novel, versioned, and feedback responsive", () => {
  const feed=[
    {id:"1",text:"Intelligenza artificiale responsabile per startup"},
    {id:"2",text:"Intelligenza artificiale responsabile e valutazione"},
    {id:"3",text:"Open source distribution for founders"},
  ];
  const base=generateIdeas(feed,[],{clock,feedback:[]});
  const topic=base.find((idea)=>idea.topic.toLocaleLowerCase("it").includes("intelligenza artificiale"))!;
  assert.ok(topic);
  assert.equal(topic.algorithmVersion,ALGORITHM_VERSION);
  const positive=generateIdeas(feed,[],{clock,feedback:[{targetType:"idea",targetId:topic.topic,vote:1,context:{topic:topic.topic},createdAt:NOW}]}).find((idea)=>idea.topic===topic.topic)!;
  const negative=generateIdeas(feed,[],{clock,feedback:[{targetType:"idea",targetId:topic.topic,vote:-1,context:{topic:topic.topic},createdAt:NOW}]}).find((idea)=>idea.topic===topic.topic)!;
  assert.ok(positive.score>topic.score);
  assert.ok(negative.score<topic.score);
  assert.ok(topic.featureExplanation!.novelty>0);
});

test("offline ranking regression meets precision, diversity, and feedback thresholds", () => {
  const ranked=rankReplyOpportunities(fixture.posts,fixture.users,{clock,ownPosts:fixture.ownPosts,feedback:[],limit:5});
  const relevant=new Set(fixture.relevantIds);
  const precisionAt5=ranked.filter((row)=>relevant.has(row.id)).length/5;
  const authorDiversity=new Set(ranked.map((row)=>row.handle)).size/5;
  const base=ranked.find((row)=>row.id==="p-ai-it")!.relevance;
  const boosted=rankReplyOpportunities(fixture.posts,fixture.users,{clock,ownPosts:fixture.ownPosts,feedback:[{targetType:"idea",targetId:"intelligenza artificiale",vote:1,context:{topic:"intelligenza artificiale"},createdAt:NOW}],limit:5}).find((row)=>row.id==="p-ai-it")!.relevance;
  assert.ok(precisionAt5>=0.8,`precision@5=${precisionAt5}`);
  assert.ok(authorDiversity>=0.8,`author diversity=${authorDiversity}`);
  assert.ok(boosted-base>=2,`feedback delta=${boosted-base}`);
});
