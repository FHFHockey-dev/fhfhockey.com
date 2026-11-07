# Sentiment discovery: assessment of the Gemini route (SS 5.5)

Written 2026-10-31 from public documentation only. No credentials, provider setup, API calls or discussion content were used. This is a capability assessment, not legal advice.

## Recommendation

**Keep discovery blocked, and do not build the Gemini route as proposed.** Keep the manual reviewed file (CONTRACT §4) as the only input to Player vs Player.

The main obstacle is the terms, more than the technology or the cost:

1. **Gemini's grounding terms conflict with what this route would do.** The route would store search-grounded results, analyze them for sentiment, and publish the outcome to an audience. The terms bar caching, syndicating or analyzing grounded results, and limit showing them to the end user who submitted the prompt.
2. **Sentiment output would not measure opinion.** A search-grounded sample has no denominator, so its output could not support a claim about what people think. SS-R06 forbids exactly that claim.
3. **Automated access to X and Reddit has its own gates.** X permits analysis of its content only when X explicitly approves it, and it requires removals that a downloaded PNG cannot honor. Reddit reportedly requires approval first, plus a separate agreement for commercial use.

TJ decides any next step. The decisions are listed under [Decisions for TJ](#decisions-for-tj).

## How each fact was checked

| Mark | Meaning |
| --- | --- |
| **Read** | I read the provider's own page on 2026-10-31, through a fetch tool that summarizes pages. Check the exact wording before relying on it |
| **Secondary** | From third-party or search-excerpt reporting, because the primary page refused the fetch. Confirm before relying on it |

All Reddit terms below are **Secondary**: `redditinc.com` and the Reddit help center refused the fetch, so I did not read Reddit's Data API Terms or Responsible Builder Policy. The help center statement on model training came through a search excerpt.

## What a Gemini route would need

| Need | Detail | Status |
| --- | --- | --- |
| A Gemini client | None exists in the repo (SOURCES.md) | Would be new |
| A credential and billing | A Google API key, and a paid tier in practice (see below) | Out of scope here |
| A use case that fits the terms | Grounded results may not be cached, syndicated, analyzed or shown beyond the prompting user | **Conflict** |
| A stored, reviewable output | CONTRACT §4 needs URL, date, claim, rationale and limitations in a checked-in file | **Conflicts with the caching limit** if taken from grounded results |
| A sampling frame | Needed for any statement about opinion. Search results have none | **Cannot be met** |
| Human review of every record | Required by CONTRACT §4 whatever the discovery method | Already in place |

## Gemini terms and behavior

**Terms: [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) (Read)**

- Grounded results and search suggestions may be used only in an application you own and operate, shown only to the end user who submitted the prompt, and shown with their search suggestions.
- You may not "cache, frame, syndicate, resell, analyze, train on, or otherwise learn from" them, or use their links to build indexes or crawl pages.
- You may not modify them or mix other content into them.
- Storage of grounded text is allowed up to two years only in limited cases, such as evaluating your display or showing a user their own chat history.
- Unpaid services: Google may use prompts and responses to improve products, and human reviewers may read them.
- Grounding: prompts, context and output are stored for 30 days for debugging and testing, on both tiers.
- Users must be 18 or older, use is for professional or business purposes, and the services are described as experimental and possibly inaccurate.

**What this means for the route.** A pipeline of search, then sentiment, then a file, then a public card appears to break the limits on analyzing, caching, syndicating and audience at once. Google's reported licensing deal with Reddit is Google's own, and nothing I read suggests it passes to API customers.

**Behavior: [Google Search grounding docs](https://ai.google.dev/gemini-api/docs/google-search) (Read)**

- Returns the executed queries, search suggestions, and text with URL citations tied to spans of the answer.
- The page makes no accuracy guarantee and sets out no coverage guarantee for Reddit or X. How much of either platform is reachable through search is **unverified**.

## Reddit (Secondary throughout)

| Topic | What is reported | Source |
| --- | --- | --- |
| Approval | Explicit approval is reported as required before accessing data through the API, and creating a script app is reported as no longer enough | [Vorp Labs](https://vorplabs.com/agent-tools/reddit-data-api), [read-it](https://glama.ai/mcp/servers/gavinmcfall/read-it) |
| Commercial use | Reported to need a separately negotiated agreement. No public rate card was found | [Prowlo](https://prowlo.com/blog/reddit-data-api), [Reddit API commercial use](https://www.redditapis.com/blogs/reddit-api-commercial-use-licensing-explained-2026) |
| Model use | Help center: no model training on Reddit content without explicit consent, and no commercial use of such models without approval | [Reddit help](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data) (search excerpt) |
| Rate limit | Reports conflict: 100 or 60 requests per minute | Same secondary sources |
| Crawling | Mid-2024 reporting: Reddit's robots.txt blocks crawlers that won't commit on AI use, and Google has a licensing deal. May be out of date | [SiliconANGLE](https://siliconangle.com/2024/07/25/reddit-blocks-bing-several-search-engines-indexing-platform) |
| New access | One blog reports new public requests stopping on 2026-10-31. **Unconfirmed**, single source | [KeyAPI](https://www.keyapi.ai/blog/reddit-data-api-overhaul-major-changes-and-migration-guide/) |

Whether classifying posts counts as "model training" was not established. Commercial status alone could still require an agreement.

## X

**Terms: [Developer Agreement](https://docs.x.com/developer-terms/agreement) and [Policy](https://docs.x.com/developer-terms/policy) (Read)**

- **Analysis:** permitted only when "explicitly approved by X" (II.A.1). Sentiment analysis isn't mentioned by name, so this clause is the closest fit. Treat it as needing X's approval.
- **Redistribution:** no passing X content to third parties except as permitted (III.A(d)). Sending post text to Gemini may fall under this; I did not find an explicit answer.
- **Display and removal:** show the latest version, and remove content within 24 hours of a removal request or as soon as reasonably possible once it is unavailable. **A downloaded or posted PNG cannot be updated**, so quoting API-retrieved text in a card is hard to reconcile with this.
- **Models:** no use to fine-tune or train a foundation or frontier model (III.A(k)).
- **Plan fit:** pay-per-use is described for hobbyists, prototyping and limited end users. Use "beyond the scope of hobbyist projects" requires Enterprise (II.L, II.M).
- **Commercial use:** defined to include use in a monetized product (III.B). Whether FHFH counts was not determined.

## Cost

These figures are the cheap part of the decision. They cover usage only, not building, review or a licence.

| Item | Published price | Illustration | Source |
| --- | --- | --- | --- |
| Gemini 3+ grounding | First 5,000 search requests a month free, then $14 per 1,000. Each query in a request counts. Default limit 1,500 requests a day on the paid tier | 20 pairs × 5 queries = 100 requests a month: inside the free allowance. Model tokens are extra and not estimated. The allowance's data terms should be checked | [Grounding docs](https://ai.google.dev/gemini-api/docs/google-search) (Read) |
| Gemini 2.5 and older | Billed per prompt | Not estimated | Same |
| X reads | $0.005 per post read, capped at 3 million a billing cycle, no free read tier, credits bought upfront | 500 posts a month: $2.50 | [X pricing](https://docs.x.com/x-api/getting-started/pricing) (Read) |
| X Enterprise | No published rate | **Unknown** | Same |
| Reddit commercial | No published rate | **Unknown**, and likely the largest item if required | Secondary, above |

## Attribution

Each record needs the URL, date, platform, a quoted or paraphrased label, the selection rationale and limitations. The Player vs Player validator refuses a record missing any of them. Beyond that:

- Paraphrase by default, and quote briefly. Credit the post through its link.
- Don't print usernames on cards. People posting about hockey are mostly private individuals, and the link already attributes the post.
- Open each URL again before exporting, since a post may have been deleted or edited since review.
- A model-written summary is not a quote. It must never carry the quoted label.

## Failure modes

| Failure | Effect | Handling today |
| --- | --- | --- |
| A vocal or brigaded thread reads as opinion | A false market signal, which SS-R06 forbids | The card always prints "No consensus established" and no tallies |
| Search ranking decides the sample | An unknown, shifting sample | No fix: search has no denominator |
| An invented or misattributed claim or URL | A false statement about a real person's post | A person opens every URL before a record is added |
| Sarcasm, slang or irony is misread | The wrong side is recorded | `favorsPlayerId` is set by a reviewer, never derived |
| Two players share a name (the NHL has had two named Sebastian Aho) | A claim lands on the wrong player | Identity is the NHL id; name is display only |
| Deleted or edited post | The card outlives its source | Re-check before export; a PNG cannot update itself |
| Non-repeatable output | The same request gives different evidence, and nothing can be audited | A checked-in file is the only input |
| Prompt injection in retrieved pages | Untrusted text steers the model | Not applicable while no model runs |
| Terms or price change | The route stops working or becomes non-compliant | Not applicable while no provider is used |
| Provider data retention | Prompts are stored for 30 days, and may be reviewed on unpaid tiers | Not applicable while no provider is used |

## Options

| Option | Fits the terms read? | Fits SS-R06? | Verdict |
| --- | --- | --- | --- |
| Manual file: TJ reads threads as a normal user and adds reviewed records | No API terms involved; site terms and copyright still apply. Short paraphrase with a link is the cautious form | Yes | **Recommended, built** |
| Gemini as a private reading aid: results are shown only to TJ and nothing is stored, then TJ finds and reads the source and writes the record | Unclear. The "analyze" and "learn from" limits may still apply, so ask Google first | Yes, if a person writes every record from the source itself | Possible later, needs confirmation |
| Licensed Reddit or X access, then a model classifies | Needs Reddit's agreement, X's analysis approval and an answer on sending text to a model | Only as attributable examples, never as a share of opinion | Not worth it for this post's volume |
| Gemini grounding feeding the file and cards automatically (as proposed) | **No**, on the terms read | **No** | **Rejected** |
| Scraping | Reportedly barred, and Reddit is litigating over it. Allegations only so far | No | **Rejected** |

## What would have to be true to unblock discovery

All of these, in writing where a provider is involved:

1. Google confirms the intended use is allowed, or the design changes so it is not using grounded results.
2. Reddit and X access is approved for FHFH's actual commercial status, including any analysis and display.
3. Every published claim is still a human-reviewed record with its URL, and the card keeps "No consensus established".
4. A stated plan covers removals after a PNG has been posted.

Even then, discovery would only find candidates. It would not make a consensus claim possible.

## Decisions for TJ

1. Whether to keep the manual file as the final design (recommended) or pursue approvals.
2. Whether FHFH counts as commercial for these terms. I did not determine this, and it changes the answer for both Reddit and X.
3. Task 5.6: whether to supply or approve any first candidates.

## Sources

Read directly: [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) · [Gemini grounding docs](https://ai.google.dev/gemini-api/docs/google-search) · [X Developer Agreement](https://docs.x.com/developer-terms/agreement) · [X Developer Policy](https://docs.x.com/developer-terms/policy) · [X API pricing](https://docs.x.com/x-api/getting-started/pricing)

Secondary: [Reddit Developer Platform help](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data) (excerpt only) · [Vorp Labs](https://vorplabs.com/agent-tools/reddit-data-api) · [read-it](https://glama.ai/mcp/servers/gavinmcfall/read-it) · [Prowlo](https://prowlo.com/blog/reddit-data-api) · [Reddit API commercial use](https://www.redditapis.com/blogs/reddit-api-commercial-use-licensing-explained-2026) · [KeyAPI](https://www.keyapi.ai/blog/reddit-data-api-overhaul-major-changes-and-migration-guide/) · [SiliconANGLE](https://siliconangle.com/2024/07/25/reddit-blocks-bing-several-search-engines-indexing-platform) · [Reddit v Anthropic commentary](https://rightstech.substack.com/p/reddit-v-anthropic-is-one-to-watch)
