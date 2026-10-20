// Recorded orchestration runs used by Demo mode. They are replayed through
// exactly the same event protocol the live backend streams, so the UI cannot
// tell the difference — only the content is pre-written.

export const SCENARIOS = [
  {
    id: 'gtm',
    label: 'Go-to-market plan',
    prompt: 'Create a go-to-market plan for an AI study-buddy app for college students in India.',
    plan: {
      goal: 'Produce an actionable go-to-market plan for an AI study-buddy app targeting Indian college students.',
      strategy:
        'Market and user research run in parallel first, since everything else depends on them. Pricing needs both; growth needs the personas; risk analysis needs the competitive picture. A reviewer then checks that every part is specific enough to execute.',
      tasks: [
        { id: 't1', title: 'Market size & competitors', agent_name: 'Market Researcher', agent_role: 'Sizes markets and maps competitive landscapes for consumer tech in India.', icon: '🔎', instructions: 'Estimate the addressable market (TAM/SAM/SOM) and map 4+ competitors with their strengths and the gap we can exploit.', depends_on: [] },
        { id: 't2', title: 'Student personas & pain points', agent_name: 'User Researcher', agent_role: 'Builds evidence-based personas and jobs-to-be-done for student products.', icon: '🧑‍🎓', instructions: 'Define 3 concrete personas, rank the top pain points and state the core job-to-be-done.', depends_on: [] },
        { id: 't3', title: 'Pricing & unit economics', agent_name: 'Pricing Strategist', agent_role: 'Designs pricing for price-sensitive markets and models unit economics.', icon: '💰', instructions: 'Propose plans and prices that fit the personas, and model ARPU, cost to serve, margin, CAC and LTV.', depends_on: ['t1', 't2'] },
        { id: 't4', title: 'Launch channels & 90-day plan', agent_name: 'Growth Marketer', agent_role: 'Plans student-focused launches across campus, creator and referral channels.', icon: '📣', instructions: 'Pick launch channels for these personas and lay out a 90-day launch plan.', depends_on: ['t2'] },
        { id: 't5', title: 'Risks & mitigations', agent_name: 'Risk Analyst', agent_role: 'Identifies business, product and regulatory risks and how to defuse them.', icon: '🛡️', instructions: 'List the key risks with likelihood, impact and a concrete mitigation for each.', depends_on: ['t1'] },
      ],
    },
    outputs: {
      t1: `## Market snapshot
- **~43M** students in Indian higher education (AISHE 2021-22); most study at least partly on a smartphone.
- Serviceable segment: engineering, medical-entrance and commerce students in Tier-1/2 cities: **~9M** students.
- At a realistic **2% paid conversion** and ₹149/month, the obtainable market is **~₹32 Cr ARR** by year 3.

## Competitive landscape
| Player | Strength | Gap we exploit |
|---|---|---|
| ChatGPT / Gemini (free) | Powerful, general | Not syllabus-aware, no exam planning |
| Byju's / Unacademy | Content library, brand | Expensive, passive video, trust issues |
| Doubtnut | Fast doubt solving | Narrow (school/JEE), ad-heavy |
| Quizlet | Flashcards | Not tuned to Indian university syllabi |

## The opening
Students don't need more content. They need **a coach that knows their exact syllabus and exam date** and tells them what to do today. No one owns personalised, syllabus-aware study coaching under ₹200/month.`,
      t2: `## Personas
**1. Riya: 2nd-year B.Tech, Pune (primary)**
- Juggles 6 subjects plus placement prep; studies 11pm–2am.
- *"I never know what to study first before mid-sems."*
- Wants: a daily plan, quick doubt clearing, past-paper practice.

**2. Arjun: NEET repeater, Kota**
- Studies 10+ hrs/day, high anxiety, tight budget.
- *"Coaching doubt queues take days."*
- Wants: instant explanations in Hinglish and weak-topic drills.

**3. Sneha: B.Com final year, Jaipur**
- Part-time job; studies in 30-minute bursts on the bus.
- *"My notes are scattered across 40 WhatsApp PDFs."*
- Wants: upload notes → summaries, flashcards, mock tests.

## Pain points (ranked)
1. No study plan tied to *their* exam dates
2. Slow or unavailable doubt resolution
3. Content overload from scattered PDFs
4. Price sensitivity: most won't pay more than ₹200/month
5. Need for Hinglish / regional-language explanations

## Job to be done
> "Tell me exactly what to study today, explain it in my language, and prove I'm ready."`,
      t3: `## Pricing: freemium with an exam-season spike
| Plan | Price | Includes |
|---|---|---|
| Free | ₹0 | 20 AI doubts/day, 1 study plan |
| **Pro** | **₹149/mo · ₹999/yr** | Unlimited doubts, note uploads, mock tests, Hinglish voice |
| Exam Sprint | ₹299 one-time | 30-day intensive plan for one exam |

Why it works: the personas cap out around ₹200/month. The annual plan (₹83/mo effective) fits semester budgets, and Sprint monetises exam-season urgency.

## Unit economics (Pro, per month)
| Metric | Value |
|---|---|
| Blended ARPU | **₹112** |
| AI inference cost / active user | ₹28 (small model routes; large model only for hard doubts) |
| Payments + infra | ₹9 |
| **Gross margin** | **~67%** |
| Target CAC | ≤ ₹350 |
| LTV (11-month avg. life) | ~₹830 |
| **LTV : CAC** | **2.4×**, trending above 3× as referrals grow |`,
      t4: `## Channels
- Instagram Reels and YouTube Shorts with study hacks
- Campus ambassador programme
- WhatsApp groups and Telegram channels
- Referral programme

## 90-day plan
- Month 1: build hype on social media
- Month 2: launch on campuses
- Month 3: scale what works`,
      t5: `| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Free general AI is "good enough" | High | High | Own what chatbots don't: syllabus mapping, exam planner, progress tracking |
| Wrong answers during exam prep | Medium | High | Retrieval over verified syllabus content, citations, one-tap "report error", expert review of top 500 topics |
| Low willingness to pay | High | Medium | Generous free tier, annual plan, one-time Sprint, UPI autopay |
| Inference costs spike | Medium | Medium | Small-model-first routing, cache common doubts, fair-use limits |
| Data privacy (DPDP Act 2023) | Medium | High | Explicit consent, data minimisation, India-region hosting, never sell student data |
| Exam seasonality | High | Low | Annual plans, Sprint pricing, off-season skill tracks |

**Biggest risk:** being seen as "just another ChatGPT wrapper". The product has to visibly know the student's syllabus on day one.`,
    },
    review: {
      overall: 'Research, pricing and risk work are specific and decision-ready. The growth plan is too generic to execute and needs budgets, targets and timing.',
      reviews: [
        { taskId: 't1', score: 9, verdict: 'approve', feedback: 'Clear sizing logic and a sharp competitive gap.' },
        { taskId: 't2', score: 9, verdict: 'approve', feedback: 'Vivid, distinct personas with ranked pains.' },
        { taskId: 't3', score: 8, verdict: 'approve', feedback: 'Pricing fits the personas; economics are plausible.' },
        { taskId: 't4', score: 5, verdict: 'revise', feedback: 'No budget, no KPIs, and no timing tied to the exam calendar. Add per-channel budget and targets, align the launch with mid-semester exams, and define a north-star metric.' },
        { taskId: 't5', score: 8, verdict: 'approve', feedback: 'Good coverage, including the DPDP Act.' },
      ],
    },
    revisions: {
      t4: `## Channel strategy
| Channel | Why it fits | 90-day budget | Target |
|---|---|---|---|
| Campus ambassadors (40 colleges) | Peer trust; reaches Riya & Sneha | ₹6.0 L | 25k sign-ups |
| Micro-creators on Reels/Shorts (50k–300k followers) | Where students discover tools | ₹5.0 L | 8M views, CPI ≤ ₹40 |
| Referral: "give a week of Pro, get a week" | Viral loop, near-zero CAC | ₹1.5 L (credits) | K-factor ≥ 0.35 |
| Telegram / WhatsApp study groups | Exam-season distribution for Arjun | ₹0.5 L | 10k sign-ups |
| **Total** | | **₹13 L** | **50k sign-ups → 2.5k paid** |

## 90-day launch plan
- **Days 1–30 · Seed:** waitlist, 10 creator collabs, ambassadors live in 40 colleges. *Goal: 15k sign-ups.*
- **Days 31–60 · Launch (timed to mid-semester exams):** "Exam Sprint" campaign, free mock-test week, inter-college leaderboard. *Goal: +25k sign-ups.*
- **Days 61–90 · Scale:** double spend on channels with CPI < ₹40, ship the Hinglish voice tutor, run a referral contest. *Goal: 2.5k paying users.*

## North-star metric
**Weekly active learners completing ≥ 3 study sessions**: target **18k by day 90**.`,
    },
    report: `# Go-to-Market Plan: AI Study Buddy for Indian College Students

## TL;DR
- **Position:** the *syllabus-aware AI study coach*: a daily plan, instant doubts and exam readiness, not another chatbot.
- **Beachhead:** ~9M engineering, medical-entrance and commerce students in Tier-1/2 cities.
- **Pricing:** Free → **Pro ₹149/mo (₹999/yr)** → **Exam Sprint ₹299**, at ~67% gross margin.
- **Launch:** ₹13L over 90 days, timed to mid-semester exams. Target **50k sign-ups and 2.5k paying users**.
- **Main risk:** being seen as a "ChatGPT wrapper". We beat it with syllabus mapping and progress tracking.

## 1. Market & positioning
India has ~43M higher-education students. Our serviceable segment is ~9M, which supports **~₹32 Cr ARR by year 3** at 2% conversion. General chatbots are powerful but don't know a student's syllabus or exam date. Ed-tech incumbents are expensive and passive. **The gap is personalised, syllabus-aware coaching under ₹200/month.**

## 2. Who we serve
| Persona | Context | What they need |
|---|---|---|
| Riya, B.Tech (Pune), *primary* | 6 subjects + placements, late-night study | "What do I study today?" + past papers |
| Arjun, NEET repeater (Kota) | 10+ hrs/day, anxious, budget-tight | Instant Hinglish explanations, weak-topic drills |
| Sneha, B.Com (Jaipur) | Part-time job, 30-min bursts | Notes → summaries, flashcards, mocks |

**Job to be done:** *"Tell me exactly what to study today, explain it in my language, and prove I'm ready."*

## 3. Pricing & unit economics
| | Free | **Pro** | Exam Sprint |
|---|---|---|---|
| Price | ₹0 | ₹149/mo · ₹999/yr | ₹299 one-time |
| Hook | 20 doubts/day | Unlimited + uploads + voice | 30-day exam plan |

Blended ARPU is **₹112** and cost to serve is **₹37**, so gross margin is **~67%**. With CAC ≤ ₹350 and LTV ≈ ₹830, **LTV:CAC is 2.4×** and climbs as referrals take over.

## 4. 90-day launch
| Phase | Moves | Goal |
|---|---|---|
| Days 1–30 · Seed | Waitlist, 10 creators, ambassadors in 40 colleges | 15k sign-ups |
| Days 31–60 · Launch | Exam Sprint campaign, free mock week, leaderboard | +25k sign-ups |
| Days 61–90 · Scale | Double down where CPI < ₹40, Hinglish voice, referral contest | 2.5k paid |

**Budget:** ₹13L (ambassadors ₹6L, creators ₹5L, referral credits ₹1.5L, communities ₹0.5L).
**North star:** weekly learners with ≥ 3 sessions, **18k by day 90**.

## 5. Key risks
- **"Good-enough" free AI:** differentiate on syllabus maps, planner and progress.
- **Wrong answers:** retrieval over verified content, citations, error reporting.
- **Willingness to pay:** annual plans, Sprint pricing, UPI autopay.
- **Privacy (DPDP Act):** consent, minimal data, India-region hosting.

## Next steps
1. Build syllabus maps for the top 3 target universities and NEET.
2. Recruit the first 40 campus ambassadors and 10 creators.
3. Ship the free tier with the study planner 4 weeks before mid-sems.
4. Instrument the north-star metric and CPI per channel from day one.`,
  },

  {
    id: 'arch',
    label: 'System design',
    prompt: 'Design the architecture for a URL shortener that handles 100 million clicks per day.',
    plan: {
      goal: 'Design a production architecture for a URL shortener serving 100M redirects per day with low latency and high availability.',
      strategy:
        'Requirements and security start in parallel. Storage and ID generation both build on the capacity numbers, so they run side by side once those land. SRE designs caching and scaling last, on top of the data and API decisions.',
      tasks: [
        { id: 't1', title: 'Requirements & capacity', agent_name: 'Systems Architect', agent_role: 'Turns product goals into requirements and back-of-the-envelope capacity numbers.', icon: '🏗️', instructions: 'Define functional and non-functional requirements and estimate QPS, storage and bandwidth.', depends_on: [] },
        { id: 't2', title: 'Data model & storage', agent_name: 'Data Engineer', agent_role: 'Chooses databases and designs schemas for large-scale key-value workloads.', icon: '🗄️', instructions: 'Design the schema and choose storage for links and click analytics, with justification.', depends_on: ['t1'] },
        { id: 't3', title: 'Short-code generation & API', agent_name: 'Backend Engineer', agent_role: 'Designs APIs and distributed ID-generation schemes.', icon: '⚙️', instructions: 'Design collision-free short-code generation and the public REST API.', depends_on: ['t1'] },
        { id: 't4', title: 'Abuse prevention & security', agent_name: 'Security Engineer', agent_role: 'Hardens public services against abuse, phishing and attacks.', icon: '🔐', instructions: 'Define the security and abuse-prevention design.', depends_on: [] },
        { id: 't5', title: 'Caching, scaling & observability', agent_name: 'Site Reliability Engineer', agent_role: 'Designs caching, multi-region scaling, SLOs and monitoring.', icon: '📈', instructions: 'Design caching, scaling and observability to hit the latency and availability targets.', depends_on: ['t2', 't3'] },
      ],
    },
    outputs: {
      t1: `## Requirements
**Functional:** create short links (optional custom alias and expiry), redirect, per-link click analytics.
**Non-functional:** p99 redirect latency **< 50 ms**, **99.99%** availability, links never collide or change.

## Capacity estimates
| Quantity | Estimate |
|---|---|
| Redirects | 100M/day → **~1,160 RPS avg, ~6k RPS peak** (5×) |
| New links | 1M/day → ~12 WPS avg, ~60 peak |
| Read : write | **~100 : 1**: optimise for reads |
| Link record | ~500 B |
| 5-year links | ~1.8B → **~0.9 TB** (+ replicas) |
| Click events | 100M/day × 200 B = **20 GB/day** raw |

**Implication:** a read-heavy key-value workload with a separate high-volume analytics stream.`,
      t2: `## Links store: DynamoDB (or Cassandra)
Single-key lookups at 6k+ RPS with predictable latency make this a key-value problem, not a relational one.

| Attribute | Type | Notes |
|---|---|---|
| \`code\` (PK) | string(7) | partition key |
| \`long_url\` | string | ≤ 2 KB |
| \`owner_id\` | string | GSI for "my links" |
| \`created_at\` / \`expires_at\` | timestamp | TTL attribute auto-deletes |
| \`status\` | enum | active / disabled / flagged |

- **Global tables** for multi-region active-active reads.
- Custom aliases use a **conditional put** (\`attribute_not_exists(code)\`), which guarantees uniqueness.

## Click analytics: Kafka → ClickHouse
Redirects publish click events asynchronously to **Kafka**. **ClickHouse** ingests them in batches (≈20 GB/day compresses ~10×) and serves per-link stats in milliseconds. Analytics never sits on the redirect hot path.`,
      t3: `## Short-code generation
- **Base62, 7 characters** → 62⁷ ≈ **3.5 trillion** codes, far beyond 1.8B.
- **Range leasing:** each app server leases blocks of 10,000 IDs from a coordinator (\`INCRBY\` on a replicated counter). No per-request coordination and no collisions.
- **Obfuscation:** pass the numeric ID through a keyed Feistel permutation before base62 encoding, so codes are **non-sequential and can't be enumerated**.

## REST API
| Method | Path | Purpose |
|---|---|---|
| \`POST\` | \`/v1/links\` | \`{url, alias?, expires_at?}\` → \`201 {code, short_url}\` |
| \`GET\` | \`/{code}\` | Redirect |
| \`GET\` | \`/v1/links/{code}/stats\` | Clicks by day, country, referrer |
| \`DELETE\` | \`/v1/links/{code}\` | Disable a link |

**302, not 301:** browsers cache 301s permanently, which would hide clicks from analytics. Use \`302\` with \`Cache-Control: private, max-age=60\`.`,
      t4: `## Security
- Use HTTPS everywhere
- Validate URLs
- Add rate limiting
- Block malicious URLs
- Use authentication for the API`,
      t5: `## Caching
- **CDN/edge** in front of redirects; cache popular codes for 60 s at the edge and log clicks at the edge.
- **Redis cluster** read-through cache: ~20% of links get ~80% of traffic, so 20M hot links × 500 B ≈ **10 GB**. Target **> 95% hit ratio**.
- Cache negative lookups briefly (5 s) to absorb random-code scans.

## Scaling
- Stateless redirect service on autoscaling containers, scaled on RPS and p99 latency.
- **Multi-region active-active** (3 regions) on DynamoDB global tables, with latency-based DNS routing.
- Kafka buffers click spikes, so analytics lag never affects redirects.

## Observability
| SLO | Target | Alert |
|---|---|---|
| Redirect p99 latency | < 50 ms | > 80 ms for 5 min |
| Availability | 99.99% | error budget burn > 2×/hr |
| Cache hit ratio | > 95% | < 90% |
| Analytics lag | < 2 min | > 10 min |

Track RED metrics (rate, errors, duration) per region, with distributed tracing on the create path.`,
    },
    review: {
      overall: 'Strong, quantified design across capacity, storage, API and SRE. The security section is a generic checklist and needs concrete controls and numbers.',
      reviews: [
        { taskId: 't1', score: 9, verdict: 'approve', feedback: 'Clean estimates that drive the later decisions.' },
        { taskId: 't2', score: 9, verdict: 'approve', feedback: 'Good split between the hot path and analytics.' },
        { taskId: 't3', score: 9, verdict: 'approve', feedback: 'Range leasing plus Feistel obfuscation is excellent. The 302 reasoning is correct.' },
        { taskId: 't4', score: 4, verdict: 'revise', feedback: 'Generic checklist. Specify URL reputation checks, concrete rate limits per client type, phishing handling, DDoS protection, takedown process and privacy of click data.' },
        { taskId: 't5', score: 8, verdict: 'approve', feedback: 'Caching math and SLOs are solid.' },
      ],
    },
    revisions: {
      t4: `## Malicious-link prevention
- **At creation:** check the URL against Google Safe Browsing and an internal domain blocklist. Reject known malware and phishing.
- **Continuously:** re-scan all links asynchronously every 24 h. Newly flagged links are set to \`status=flagged\`.
- Flagged links show an **interstitial warning page** instead of redirecting.

## Rate limits (token bucket, Redis-backed)
| Client | Create links | Redirects |
|---|---|---|
| Anonymous (per IP) | 10 / hour | 300 / min |
| Signed-in user | 1,000 / day | n/a |
| API key (paid tier) | 100 / sec | n/a |

## Enumeration & DDoS
- Non-sequential Feistel-permuted codes plus 5 s negative caching make scanning useless.
- **CDN + WAF** (bot scoring, geo rules) and L3/L4 DDoS protection in front of everything.

## Abuse response
- Public **report-abuse** endpoint. Trusted-reporter flags auto-disable a link, and every report gets a **1-hour takedown SLA**.

## Auth & privacy
- OAuth 2.0 for users. API keys are scoped (\`links:write\`, \`stats:read\`), hashed at rest and rotatable.
- Click IPs are **salted-hashed with a daily-rotating salt**. Raw IPs are never stored, which keeps analytics GDPR-friendly.`,
    },
    report: `# Architecture: URL Shortener at 100M Clicks/Day

## TL;DR
- A **read-heavy (100:1) key-value workload**: ~1,160 RPS on average, ~6k RPS at peak, p99 < 50 ms, 99.99% availability.
- **DynamoDB global tables** for links; **Kafka → ClickHouse** for click analytics, kept off the hot path.
- **7-char base62 codes** from leased ID ranges, permuted with a Feistel cipher so they can't be enumerated.
- **CDN + Redis** caching (> 95% hit ratio), with stateless redirect services in **3 active-active regions**.
- Abuse is handled with Safe Browsing checks, tiered rate limits, a WAF and a 1-hour takedown SLA.

## Architecture
\`\`\`
Client ─▶ CDN / WAF ─▶ Redirect service (stateless, autoscaled)
                           │  ├─▶ Redis cluster (hot links, ~10 GB)
                           │  └─▶ DynamoDB global tables (links)
                           └─▶ Kafka (click events) ─▶ ClickHouse (analytics)
Create API ─▶ Safe Browsing check ─▶ ID range lease ─▶ DynamoDB
\`\`\`

## 1. Capacity
| | Estimate |
|---|---|
| Redirects | 100M/day · ~6k RPS peak |
| New links | 1M/day · ~60 WPS peak |
| Storage (5 yrs) | ~1.8B links ≈ 0.9 TB |
| Click events | ~20 GB/day raw |

## 2. Data
- **Links:** DynamoDB with \`code\` as partition key, a GSI on \`owner_id\`, and TTL for expiry. Custom aliases use conditional puts.
- **Analytics:** asynchronous events into Kafka, batched into ClickHouse for millisecond per-link stats.

## 3. Short codes & API
- Base62 × 7 chars gives **3.5T codes**. Servers lease **10k-ID blocks**, so there is no per-request coordination.
- \`POST /v1/links\`, \`GET /{code}\` (**302** so clicks stay measurable), \`GET /v1/links/{code}/stats\`, \`DELETE /v1/links/{code}\`.

## 4. Performance & reliability
- Edge caching for 60 s, plus a Redis read-through cache sized for the hottest 20M links.
- Three regions, active-active, with latency-based routing. Kafka absorbs traffic spikes.
- **SLOs:** p99 < 50 ms, 99.99% availability, cache hit > 95%, analytics lag < 2 min.

## 5. Security & abuse
| Control | Design |
|---|---|
| Malicious links | Safe Browsing at creation + 24 h re-scans + warning interstitial |
| Rate limits | 10/h anonymous · 1,000/day users · 100/s paid API |
| Enumeration / DDoS | Permuted codes, negative caching, WAF + DDoS protection |
| Privacy | Salted, daily-rotated IP hashes; no raw IPs stored |

## Next steps
1. Load-test the redirect path at 10k RPS with a 95% cache-hit profile.
2. Implement the ID-range lease service and the Feistel permutation with tests.
3. Wire up the Safe Browsing integration and the abuse-report workflow.
4. Define SLO dashboards and burn-rate alerts before launch.`,
  },

  {
    id: 'ev',
    label: 'Decision analysis',
    prompt: 'Should I buy an EV or a hybrid for a 60 km daily commute in Bengaluru with a ₹18 lakh budget?',
    plan: {
      goal: 'Recommend EV vs hybrid for a 60 km/day Bengaluru commuter with an ₹18L budget, backed by cost, practicality and model analysis.',
      strategy:
        'Cost, charging practicality and model shortlisting are independent, so three agents run them in parallel. A decision advisor then weighs all three in a scored matrix.',
      tasks: [
        { id: 't1', title: '5-year cost of ownership', agent_name: 'Cost Analyst', agent_role: 'Models total cost of ownership for vehicles in Indian conditions.', icon: '🧮', instructions: 'Compare 5-year running and ownership costs for an EV vs a strong hybrid at 60 km/day.', depends_on: [] },
        { id: 't2', title: 'Charging & practicality', agent_name: 'Infrastructure Scout', agent_role: 'Evaluates charging infrastructure and day-to-day practicality in Indian cities.', icon: '🔌', instructions: 'Assess home/public charging, range needs and practicality in Bengaluru for this commute.', depends_on: [] },
        { id: 't3', title: 'Model shortlist', agent_name: 'Auto Expert', agent_role: 'Knows the Indian car market and real-world model trade-offs.', icon: '🚗', instructions: 'Shortlist 2 EVs and 2 hybrids within ₹18L on-road, with real-world efficiency.', depends_on: [] },
        { id: 't4', title: 'Weighted decision matrix', agent_name: 'Decision Advisor', agent_role: 'Turns analysis into clear, weighted recommendations.', icon: '⚖️', instructions: 'Combine the cost, practicality and model findings into a weighted decision matrix and a recommendation.', depends_on: ['t1', 't2', 't3'] },
      ],
    },
    outputs: {
      t1: `## Assumptions (illustrative)
- 60 km × 26 days × 12 months ≈ **18,700 km/year**
- Petrol ₹103/L; home electricity ₹8/kWh
- EV ~7 km/kWh real-world; strong hybrid ~22 km/L real-world

## Running cost per year
| | EV | Strong hybrid |
|---|---|---|
| Energy | 2,670 kWh → **₹21k** | 850 L → **₹88k** |
| Service | ₹5k | ₹10k |
| Insurance (avg.) | ₹38k | ₹40k |

## 5-year view
| | EV | Strong hybrid |
|---|---|---|
| On-road price | ₹16.5L | ₹18.0L |
| Running (5 yrs) | ₹3.2L | ₹6.9L |
| Home charger | ₹0.5L | — |
| Est. resale (yr 5) | −₹7.0L | −₹9.0L |
| **Net 5-year cost** | **₹13.2L** | **₹15.9L** |

**The EV saves ~₹2.7L over 5 years**, mostly on fuel. The gap widens with higher mileage.`,
      t2: `## Range need
60 km/day is **~20–25% of a typical 300–400 km real-world EV range**, so a weekly or alternate-day home charge is enough. Range anxiety isn't a factor for this commute.

## Charging in Bengaluru
- **Home charging is the deciding factor.** A 7.4 kW wall box fully charges overnight. Apartment societies need NOC approval and a dedicated meter, which takes 2–6 weeks.
- **Public:** Bengaluru has one of India's densest networks (BESCOM, Tata Power, Statiq, ChargeZone). DC fast charging 10→80% takes ~45–60 min, which is fine for occasional use.
- **Long trips:** Bengaluru → Mysuru/Chennai corridors are well covered. Remote highway trips still need planning.

## Practicality
| Factor | EV | Hybrid |
|---|---|---|
| Stop-go traffic | Excellent (regen, no idling) | Excellent (EV mode at low speed) |
| Long road trips | Needs planning | Effortless |
| Without home charging | Inconvenient | No change |

**Verdict:** an EV is clearly practical **if you can charge at home or work**.`,
      t3: `## Shortlist (≤ ₹18L on-road, illustrative)
| Model | Type | Real-world efficiency | Strengths | Watch-outs |
|---|---|---|---|---|
| **Tata Nexon EV (LR)** | EV | ~6.5–7 km/kWh, ~350 km range | Proven, wide service network, 5-star safety | Firm ride |
| **MG Windsor EV** | EV | ~7 km/kWh, ~280–300 km range | Spacious, comfortable, lounge-like cabin | Battery-rental option complicates cost |
| **Toyota Urban Cruiser Hyryder (strong hybrid)** | Hybrid | ~20–23 km/L | Toyota reliability, smooth in traffic | Top variants push past ₹18L |
| **Maruti Grand Vitara (strong hybrid)** | Hybrid | ~20–23 km/L | Large service network, resale | Small boot (battery) |

All four handle a 60 km Bengaluru commute comfortably. The EVs cost less to run; the hybrids cost more to buy but are effortless on road trips.`,
      t4: `## Weighted decision matrix
| Criterion | Weight | EV | Hybrid |
|---|---|---|---|
| 5-year cost | 35% | **9** | 6 |
| Daily commute experience | 25% | **9** | 8 |
| Charging / refuelling convenience | 20% | 7* | **9** |
| Long-trip flexibility | 10% | 6 | **9** |
| Resale certainty | 10% | 6 | **8** |
| **Weighted score** | | **8.00** | **7.60** |

*\\*Assumes home charging. Without it, EV convenience drops to 4 and the EV's score falls to ~7.40, below the hybrid's 7.60.*

## Recommendation
**Buy the EV (Tata Nexon EV LR or MG Windsor EV) if you can install a home charger.** It saves ~₹2.7L over 5 years and is ideal for stop-go traffic.
**Choose the strong hybrid (Hyryder / Grand Vitara)** if home charging is impossible or you take frequent long highway trips.`,
    },
    review: {
      overall: 'All four deliverables are specific, consistent with one another and decision-ready. No revisions needed.',
      reviews: [
        { taskId: 't1', score: 9, verdict: 'approve', feedback: 'Transparent assumptions and a full TCO, including resale.' },
        { taskId: 't2', score: 9, verdict: 'approve', feedback: 'Correctly identifies home charging as the decisive factor.' },
        { taskId: 't3', score: 8, verdict: 'approve', feedback: 'Balanced shortlist with honest watch-outs.' },
        { taskId: 't4', score: 9, verdict: 'approve', feedback: 'Weights are sensible, and the sensitivity note on home charging is excellent.' },
      ],
    },
    revisions: {},
    report: `# EV or Hybrid for a 60 km Bengaluru Commute?

## TL;DR
- **Buy an EV if you can charge at home.** It's ~₹2.7L cheaper over 5 years and ideal for stop-go traffic.
- **Pick a strong hybrid if you can't charge at home** or you take frequent long highway trips.
- 60 km/day uses only ~20–25% of a modern EV's range, so range anxiety isn't a real factor.
- Shortlist: **Tata Nexon EV LR**, **MG Windsor EV** · **Toyota Hyryder**, **Maruti Grand Vitara** (strong hybrids).
- *Figures are illustrative; verify current on-road prices and tariffs before buying.*

## 1. The money
| 5-year view | EV | Strong hybrid |
|---|---|---|
| On-road price | ₹16.5L | ₹18.0L |
| Energy + service (5 yrs) | ₹3.2L | ₹6.9L |
| Home charger | ₹0.5L | — |
| Resale (yr 5) | −₹7.0L | −₹9.0L |
| **Net cost** | **₹13.2L** | **₹15.9L** |

At ~18,700 km/year, the EV spends **~₹21k/year on electricity** versus **~₹88k/year on petrol** for the hybrid.

## 2. Practicality in Bengaluru
- **Home charging decides it.** A 7.4 kW wall box charges overnight. Get your society's NOC early, as it can take 2–6 weeks.
- Bengaluru has one of India's densest public charging networks. Fast charging 10→80% takes 45–60 min, which is fine for occasional use.
- In traffic, both are excellent. On highway trips, the hybrid is effortless and the EV needs some planning.

## 3. Shortlist
| Model | Type | Real-world efficiency | Why |
|---|---|---|---|
| Tata Nexon EV (LR) | EV | ~350 km range | Proven, 5-star safety, wide service network |
| MG Windsor EV | EV | ~280–300 km range | Spacious, comfortable |
| Toyota Hyryder | Strong hybrid | ~20–23 km/L | Reliability, smooth in traffic |
| Maruti Grand Vitara | Strong hybrid | ~20–23 km/L | Service network, resale |

## 4. Decision matrix
| Criterion (weight) | EV | Hybrid |
|---|---|---|
| 5-year cost (35%) | **9** | 6 |
| Commute experience (25%) | **9** | 8 |
| Charging convenience (20%) | 7 | **9** |
| Long trips (10%) | 6 | **9** |
| Resale certainty (10%) | 6 | **8** |
| **Score** | **8.00** | 7.60 |

Without home charging, the EV drops to ~7.40 and **the hybrid wins**.

## Next steps
1. Confirm with your society or office that you can install a charger (NOC + meter).
2. Test-drive the Nexon EV LR and the Windsor EV back-to-back on your actual commute.
3. Get on-road quotes for all four and re-run the 5-year math with real numbers.
4. If charging is a no, test-drive the Hyryder and the Grand Vitara instead.`,
  },
];
