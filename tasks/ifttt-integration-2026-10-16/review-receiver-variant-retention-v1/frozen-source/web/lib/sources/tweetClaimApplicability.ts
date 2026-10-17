import { easternReportDate } from "./projectedLineups";

type Span={start:number;end:number;text:string};
const instant=(value:unknown)=>typeof value==="string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;
/** Explicit source-date evidence for an already bound game; it cannot select a game ID. */
export type TweetClaimGameApplicability={
  version:"explicit-game-date-v1";gameId:number;teamId:number;date:string;startTime:string;publishedAt:string;governingClause:Span;
};

export function explicitTweetClaimGameApplicability(args:{game:{id:number;date:string;startTime:string;homeTeamId:number;awayTeamId:number};
  teamId:number;publishedAt:string;text:string;governingClause:Span}):TweetClaimGameApplicability|null{
  const {game,teamId,publishedAt,text,governingClause:clause}=args;
  if(!Number.isSafeInteger(game.id)||game.id<=0||![game.homeTeamId,game.awayTeamId].includes(teamId)
    ||!Number.isFinite(instant(publishedAt))||!Number.isFinite(instant(game.startTime))
    ||instant(game.startTime)<=instant(publishedAt)||easternReportDate(game.startTime)!==game.date
    ||!Number.isInteger(clause.start)||!Number.isInteger(clause.end)||clause.start<0||clause.end<=clause.start
    ||clause.end>text.length||text.slice(clause.start,clause.end)!==clause.text)return null;
  const dates=[...new Set(clause.text.match(/\b\d{4}-\d{2}-\d{2}\b/g)??[])];
  if(dates.length!==1||dates[0]!==game.date)return null;
  return {version:"explicit-game-date-v1",gameId:game.id,teamId,date:game.date,startTime:game.startTime,publishedAt,
    governingClause:{start:clause.start,end:clause.end,text:clause.text}};
}

export function validTweetClaimGameApplicability(proof:TweetClaimGameApplicability,args:{gameId:number;teamId:number;publishedAt:string;effectiveAt:string|null;text:string;governingClause:Span}){
  if(proof?.version!=="explicit-game-date-v1"||proof.gameId!==args.gameId||proof.teamId!==args.teamId
    ||proof.publishedAt!==args.publishedAt||!Number.isFinite(instant(args.effectiveAt))||instant(proof.startTime)!==instant(args.effectiveAt)
    ||proof.governingClause?.start!==args.governingClause.start
    ||proof.governingClause.end!==args.governingClause.end||proof.governingClause.text!==args.governingClause.text)return false;
  return explicitTweetClaimGameApplicability({game:{id:proof.gameId,date:proof.date,startTime:proof.startTime,
    homeTeamId:args.teamId,awayTeamId:args.teamId},teamId:args.teamId,publishedAt:args.publishedAt,text:args.text,governingClause:args.governingClause})!==null;
}
