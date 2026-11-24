# Chaos Meter — Planning Baseline

**Version:** 0.1
**Baseline date:** November 24, 2026
**Project:** Chaos Meter, for the Impact Team Spring 2027 Technical Assessment
**Assessment deadline:** Sunday, November 29, 2026, 11:59 p.m. (Boston local time)
**Repository:** https://github.com/dribeiro0/technical-assessment-spring-27

## Purpose

These files record how Chaos Meter was planned before any application code was written: what the product is for, how its parts depend on each other, which ideas were accepted, which are still proposals, and what has to be proven with evidence.

They are planning records, not a description of working software. **No application feature described here is implemented as of this baseline.** The repository contained only the assessment `README.md` and `pr_template.md` when these files were written.

## Reading order

1. `00_master_plan.txt` — the whole product end to end, and the delivery order.
2. `10_assessment_audit.txt` — what the assessment actually requires, and how each requirement maps to a planned feature.
3. `01_product_vision.txt` — audiences, the two experiences, and network coverage.
4. `02_functional_architecture.txt` — how MBTA data moves through the system.
5. Subsystem files `03` to `09`, as needed.
6. `11_visual_mapping.txt` — screens, navigation, and journeys (functional only).
7. `12_decision_log.txt` — decisions, alternatives, and open questions.

## File index

| File | Contents |
|---|---|
| `readme.md` | This index, status legend, and provenance |
| `00_master_plan.txt` | End-to-end product summary, delivery order, dependencies, cut list |
| `01_product_vision.txt` | Problem, audiences, Command Center and Commuter Companion, coverage strategy |
| `02_functional_architecture.txt` | Data pipeline, entity model, change propagation, state categories |
| `03_chaos_engine.txt` | Scoring model history, candidate formulations, scopes, confidence, research plan |
| `04_transit_and_prediction.txt` | Vehicle tracking, branches, platforms, MBTA-first predictions, prediction evaluation |
| `05_alerts_and_intelligence.txt` | Official alerts, detected irregularities, lifecycle, relevance |
| `06_my_commute.txt` | Saved stops and journeys, the full journey flow, failure cases |
| `07_analytics_and_data.txt` | Public vs. internal analytics, continuous collection, data records, the assessment chart |
| `08_reliability_and_recovery.txt` | Subsystem health, failure-to-behavior mapping, recovery |
| `09_nonfunctional_requirements.txt` | Accessibility, privacy, security, constrained networks, performance targets |
| `10_assessment_audit.txt` | Requirement-by-requirement matrix from the README and PR template |
| `11_visual_mapping.txt` | Information hierarchy, layouts, navigation, detail panels, journeys |
| `12_decision_log.txt` | Decision records with alternatives, rationale, consequences |
| `13_engineering_handoff.txt` | Intentionally empty. The engineering handoff has not been written yet. |

## Decision-status legend

Every substantive statement in these files carries one of these labels.

| Label | Meaning |
|---|---|
| `[ACCEPTED]` | David explicitly agreed to it, or gave it as a direction himself. |
| `[PROPOSED]` | Suggested during planning (usually by the planning assistant) and not explicitly accepted. Needs a decision. |
| `[UNVALIDATED]` | An assumption or research claim that needs evidence before it can be relied on. |
| `[DEFERRED]` | Deliberately postponed: visual identity, technology stack, implementation mechanisms. |
| `[OPEN]` | A question that has not been answered. |
| `[MOCK]` | Illustrative numbers, times, or scenarios. Not live data and not measured results. |

Feature verification status is tracked separately in `10_assessment_audit.txt`. At this baseline every feature is `NOT STARTED`.

## Current planning status

- Decided at the functional level: product vision, audiences, desktop and mobile experiences, functional architecture, Chaos Engine direction, transit and prediction approach, alerts and transit intelligence, My Commute, analytics, data management, reliability.
- Partly done: performance, accessibility, privacy, security.
- Not done: visual design, formal acceptance criteria per subsystem, engineering roadmap, engineering handoff.
- Implementation: none.

## AI assistance

The assessment README permits LLM assistance. Product planning was done by David with ChatGPT as a planning assistant. Raw conversations and prompts are not included. David is responsible for the decisions and must understand any code built from them.

## Roles

- Product planning and product review: David, with ChatGPT as a planning assistant.
- Technical architecture, technology selection, and engineering: Claude, under David's direction.
- The assessment explicitly permits LLM assistance, provided the applicant understands the code. David is responsible for every decision recorded here and for understanding the eventual implementation.

## Provenance

### Sources reviewed for this baseline

1. **Original planning conversation (reviewed in full).**
   Shared ChatGPT conversation "Plan Chaos Meter Architecture",
   https://chatgpt.com/share/6b05fd75-26c8-83e9-bb53-51b731807ad9 .
   Read on November 24, 2026 as rendered page text (about 150,000 characters), from the first message to the last. The share also contains the later turns about failed Work-mode handoffs, the D:\Projects permission block, and the prompt for a new H4I Project chat. Several assistant replies contained interactive widgets (sliders, simulators, mock layouts). Only their rendered text was available; their visual layout was not.

2. **David's master project prompt** ("Chaos Meter - Master Project Context and Execution Prompt", supplied November 24, 2026). Used as a baseline and reconciled against the conversation. Where it states something the conversation does not, the files say so.

3. **Assessment files (read directly from the repository at commit 8381263).**
   `README.md` (SHA-256 8a00f0b9d0d7ea96ed07efb9d082de76a11d455239cbd38914c5070908a1520d) and
   `pr_template.md` (SHA-256 c2813c2dc82bd6d2bcf99e4715abb3ba05d44ecd384d3e2e2363df17d4cd743c).
   Both are unchanged by this baseline.

4. **Research and data sources checked on November 24, 2026.**
   - Furth, P. G. and Muller, T. H. J., "Service Reliability and Hidden Waiting Time: Insights from Automatic Vehicle Location Data," Transportation Research Record 1955 (2006), pp. 79-87. Title, authors, venue, and abstract confirmed through the TRB TRID record. DOI as supplied: 10.1177/0361198106195500110 (the DOI string itself was not resolved).
   - MBTA OPMI Data Blog, "Introducing Excess Trip Time," December 19, 2024. https://www.opmidatablog.com/latest-posts/introducing-excess-trip-time (read in full).
   - MBTA transit-performance repository, https://github.com/mbta/transit-performance . Confirmed MIT-licensed and archived (read-only) on March 4, 2026.
   - MBTA V3 API specification, https://api-v3.mbta.com/docs/swagger/swagger.json (paths, vehicle and prediction attributes, API-key and rate-limit notes).

### Sources that were NOT available

- **Separate H4I Project conversation** ("Continue Chaos Meter Planning", the later local-setup attempts, the disappearing Work-mode handoff, and the creation of a planning ZIP). Not retrieved. Only what the shared conversation above says about those events is reflected here. If that thread contains decisions not in the shared conversation, they are missing from this baseline.
- **Earlier planning ZIP** (`chaos-meter-planning-baseline-v0.1.zip`). Not found or not accessible in the session that wrote this baseline. These files were written from the original conversation and the sources above. They are **not** a revision checked against that ZIP. The shared conversation itself states that the ZIP had not yet been generated at the end of that conversation.
- **"Chaos Meter MBTA Dashboard Flow.png"** reference image. Not available. The visual mapping is reconstructed from the conversation text only.
- **Leads mentioned in the conversation but not identified:** a 2022 Transportation Research Part A article on waiting-time models, 2018 transit congestion research valuing waiting time at 2 to 2.5 times in-vehicle time, the Transit Capacity and Quality of Service Manual as cited, and an unnamed Springer source for the waiting-time formula. These remain unresolved leads (see `03_chaos_engine.txt`).

### What stays out of the repository

Raw chat transcripts, the planning ZIP, prompts, personal details, and credentials.
