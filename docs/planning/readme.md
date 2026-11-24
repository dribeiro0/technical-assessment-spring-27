# Chaos Meter - Planning Baseline

**Start here.** Follow the nine sprints in section 3 of 00_master_plan.txt. Section 5 records the release boundary and accepted interface behavior by sprint. Use 10_assessment_audit.txt to verify the submission. Sprints 1-3 deliver the assessment, Sprint 4 is optional, and Sprints 5-9 develop the personal app.

**Version:** 0.1
**Baseline date:** November 24, 2026
**Project:** Chaos Meter, for the Impact Team Spring 2027 Technical Assessment
**Assessment deadline:** Sunday, November 29, 2026, 11:59 p.m. (Boston local time)
**Repository:** https://github.com/dribeiro0/technical-assessment-spring-27

## Purpose

Chaos Meter combines live MBTA network exploration with personal commute monitoring. This baseline defines the product, delivery priorities, and evidence required to verify each feature.

## Reading order

1. `00_master_plan.txt` - the whole product end to end, and the delivery order.
2. `10_assessment_audit.txt` - what the assessment actually requires, and how each requirement maps to a planned feature.
3. `01_product_vision.txt` - audiences, the two experiences, and network coverage.
4. `02_functional_architecture.txt` - how MBTA data moves through the system.
5. Subsystem files `03` to `09`, as needed.
6. `11_visual_mapping.txt` - screens, navigation, and journeys (functional only).
7. `12_decision_log.txt` - accepted product and system decisions.

## File index

| File | Contents |
|---|---|
| `readme.md` | Planning index and status legend |
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
| `12_decision_log.txt` | Accepted product and system decisions |
| `13_engineering_handoff.txt` | Engineering handoff draft: release scope, accepted behavior and technical design requested for review. |

## Decision-status legend

Every substantive statement in these files carries one of these labels.

| Label | Meaning |
|---|---|
| `[ACCEPTED]` | Established product direction. |
| `[PROPOSED]` | Candidate approach pending a decision. |
| `[UNVALIDATED]` | An assumption or research claim that needs evidence before it can be relied on. |
| `[DEFERRED]` | Deliberately postponed: visual identity, technology stack, implementation mechanisms. |
| `[OPEN]` | A question that has not been answered. |
| `[MOCK]` | Illustrative numbers, times, or scenarios. Not live data and not measured results. |

Feature verification status is tracked separately in `10_assessment_audit.txt`. At this baseline every feature is `NOT STARTED`.

## Sources

1. **Assessment files (read directly from the repository at commit 8381263).**
   `README.md` (SHA-256 8a00f0b9d0d7ea96ed07efb9d082de76a11d455239cbd38914c5070908a1520d) and
   `pr_template.md` (SHA-256 c2813c2dc82bd6d2bcf99e4715abb3ba05d44ecd384d3e2e2363df17d4cd743c).
   Both are unchanged by this baseline.

2. **Research and data sources checked on November 24, 2026.**
   - Furth, P. G. and Muller, T. H. J., "Service Reliability and Hidden Waiting Time: Insights from Automatic Vehicle Location Data," Transportation Research Record 1955 (2006), pp. 79-87. Title, authors, venue, and abstract confirmed through the TRB TRID record. DOI as supplied: 10.1177/0361198106195500110 (the DOI string itself was not resolved).
   - MBTA OPMI Data Blog, "Introducing Excess Trip Time," December 19, 2024. https://www.opmidatablog.com/latest-posts/introducing-excess-trip-time (read in full).
   - MBTA transit-performance repository, https://github.com/mbta/transit-performance . Confirmed MIT-licensed and archived (read-only) on March 4, 2026.
   - MBTA V3 API specification, https://api-v3.mbta.com/docs/swagger/swagger.json (paths, vehicle and prediction attributes, API-key and rate-limit notes).
